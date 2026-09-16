import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone

CK_PRICELIST_URL = "https://api.cardkingdom.com/api/v2/pricelist"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PAGE_SIZE = 1000
PATCH_BATCH_SIZE = 200


def require_environment():
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        raise RuntimeError("Missing required environment variables: " + ", ".join(missing))


def supabase_request(method, path, payload=None, extra_headers=None):
    url = f"{SUPABASE_URL}/rest/v1/{path.lstrip('/')}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            body = response.read()
            return json.loads(body.decode("utf-8")) if body else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path} failed ({exc.code}): {body}") from exc


def fetch_target_ids():
    print("Reading Scryfall IDs from Supabase...")
    result = set()
    offset = 0
    while True:
        rows = supabase_request(
            "GET",
            f"cards?select=scryfall_id&order=scryfall_id&limit={PAGE_SIZE}&offset={offset}",
        ) or []
        for row in rows:
            value = row.get("scryfall_id")
            if value:
                result.add(str(value))
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    print(f"Target Scryfall printings: {len(result):,}")
    return result


def as_price(value):
    if value is None or value == "":
        return None
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    return round(price, 2) if price >= 0 else None


def extract_rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "products", "pricelist"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    raise RuntimeError("Unexpected Card Kingdom pricelist response shape")


def fetch_cardkingdom_pricelist():
    print(f"Downloading Card Kingdom direct pricelist: {CK_PRICELIST_URL}")
    req = urllib.request.Request(
        CK_PRICELIST_URL,
        headers={
            "User-Agent": "mtg-display-cr/1.0 (daily price synchronization)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=300) as response:
        payload = json.load(response)
    rows = extract_rows(payload)
    print(f"Card Kingdom products received: {len(rows):,}")
    return rows


def finish_for_product(product):
    # The public CK feed exposes is_foil. Treat non-foil and foil explicitly.
    # Etched remains untouched until CK exposes an unambiguous finish signal.
    value = product.get("is_foil")
    if value is True or value == 1 or str(value).strip().lower() in {"true", "1", "yes"}:
        return "foil"
    return "normal"


def retail_price(product):
    # Prefer the headline retail price. NM is retained as a fallback because
    # the v2 feed can expose condition-specific retail fields.
    price = as_price(product.get("price_retail"))
    if price is not None:
        return price
    conditions = product.get("condition_values") or {}
    return as_price(conditions.get("nm_price"))


def build_direct_prices(products, target_ids):
    prices = {}
    matched_products = 0
    for product in products:
        scryfall_id = product.get("scryfall_id")
        if not scryfall_id or str(scryfall_id) not in target_ids:
            continue
        price = retail_price(product)
        if price is None:
            continue
        matched_products += 1
        sid = str(scryfall_id)
        finish = finish_for_product(product)
        row = prices.setdefault(sid, {"normal": None, "foil": None})
        # Multiple CK products can map to one Scryfall printing. Keep the
        # lowest current retail listing for the same finish rather than mixing
        # editions; the Scryfall ID already guarantees the exact printing.
        current = row[finish]
        if current is None or price < current:
            row[finish] = price

    print(f"CK products matching our catalog: {matched_products:,}")
    print(f"Scryfall printings with direct CK price: {len(prices):,}")
    return prices


def chunked(values, size):
    values = list(values)
    for start in range(0, len(values), size):
        yield values[start : start + size]


def patch_finish(ids, column, price_map, timestamp):
    updated = 0
    # PostgREST cannot assign a different value to each row in one PATCH, so
    # updates remain row-specific. This is still scalable because the CK feed
    # is downloaded once and matching is O(products + catalog), not per card.
    for sid in ids:
        value = price_map[sid]
        encoded = urllib.parse.quote(sid, safe="")
        supabase_request(
            "PATCH",
            f"cards?scryfall_id=eq.{encoded}",
            {column: value, "cardkingdom_price_updated_at": timestamp},
            {"Prefer": "return=minimal"},
        )
        updated += 1
    return updated


def sync(prices):
    timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    normal = {sid: row["normal"] for sid, row in prices.items() if row.get("normal") is not None}
    foil = {sid: row["foil"] for sid, row in prices.items() if row.get("foil") is not None}

    print("Syncing direct Card Kingdom prices to Supabase...")
    normal_count = patch_finish(normal.keys(), "cardkingdom_normal_usd", normal, timestamp)
    foil_count = patch_finish(foil.keys(), "cardkingdom_foil_usd", foil, timestamp)
    print(f"Direct CK normal prices updated: {normal_count:,}")
    print(f"Direct CK foil prices updated:   {foil_count:,}")
    print("Etched prices were left unchanged intentionally.")


def print_validation(prices):
    sid = "09ecd919-6f99-47fd-8242-b0b062e98b45"
    if sid not in prices:
        print("Validation case The Irencrag: no direct CK match")
        return
    print("Validation case: The Irencrag")
    print(f"  Scryfall ID: {sid}")
    print(f"  normal: {prices[sid].get('normal')}")
    print(f"  foil:   {prices[sid].get('foil')}")


def main():
    require_environment()
    target_ids = fetch_target_ids()
    if not target_ids:
        print("No cards exist in public.cards. Nothing to update.")
        return
    products = fetch_cardkingdom_pricelist()
    prices = build_direct_prices(products, target_ids)
    print_validation(prices)
    sync(prices)
    missing = len(target_ids - set(prices.keys()))
    print(f"Catalog printings without a direct CK match: {missing:,}")
    print("Direct Card Kingdom synchronization completed successfully.")


if __name__ == "__main__":
    main()
