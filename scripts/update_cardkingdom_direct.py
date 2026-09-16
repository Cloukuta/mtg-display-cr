import json
import os
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

CK_PRICELIST_URL = "https://api.cardkingdom.com/api/v2/pricelist"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PAGE_SIZE = 1000
UPSERT_BATCH_SIZE = 500

CK_CONDITION_FIELDS = {"NM": "nm_price", "EX": "ex_price", "VG": "vg_price", "G": "g_price"}
FINISH_DIAGNOSTIC_NAMES = {"captain n'ghathrod"}


def require_environment():
    missing = []
    if not SUPABASE_URL: missing.append("SUPABASE_URL")
    if not SUPABASE_KEY: missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing: raise RuntimeError("Missing required environment variables: " + ", ".join(missing))


def supabase_request(method, path, payload=None, extra_headers=None):
    url = f"{SUPABASE_URL}/rest/v1/{path.lstrip('/')}"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Accept": "application/json"}
    if payload is not None: headers["Content-Type"] = "application/json"
    if extra_headers: headers.update(extra_headers)
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            body = response.read(); return json.loads(body.decode("utf-8")) if body else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path} failed ({exc.code}): {body}") from exc


def fetch_target_cards():
    print("Reading card catalog from Supabase...")
    result = {}; offset = 0
    while True:
        rows = supabase_request("GET", f"cards?select=scryfall_id,name,set_code,collector_number&order=scryfall_id&limit={PAGE_SIZE}&offset={offset}") or []
        for row in rows:
            sid = row.get("scryfall_id")
            if sid: result[str(sid)] = row
        if len(rows) < PAGE_SIZE: break
        offset += PAGE_SIZE
    print(f"Target Scryfall printings: {len(result):,}")
    return result


def as_price(value):
    if value is None or value == "": return None
    try: price = float(value)
    except (TypeError, ValueError): return None
    return round(price, 2) if price >= 0 else None


def extract_rows(payload):
    if isinstance(payload, list): return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "products", "pricelist"):
            value = payload.get(key)
            if isinstance(value, list): return value
    raise RuntimeError("Unexpected Card Kingdom pricelist response shape")


def fetch_cardkingdom_pricelist():
    print(f"Downloading Card Kingdom direct pricelist: {CK_PRICELIST_URL}")
    req = urllib.request.Request(CK_PRICELIST_URL, headers={"User-Agent":"mtg-display-cr/1.0 (daily price synchronization)","Accept":"application/json"})
    with urllib.request.urlopen(req, timeout=300) as response: payload = json.load(response)
    rows = extract_rows(payload); print(f"Card Kingdom products received: {len(rows):,}"); return rows


def finish_for_product(product):
    value = product.get("is_foil")
    return "foil" if value is True or value == 1 or str(value).strip().lower() in {"true","1","yes"} else "nonfoil"


def condition_prices(product):
    values = product.get("condition_values") or {}; result = {}
    for condition, field in CK_CONDITION_FIELDS.items():
        price = as_price(values.get(field))
        if price is not None: result[condition] = price
    if "NM" not in result:
        retail = as_price(product.get("price_retail"))
        if retail is not None: result["NM"] = retail
    return result


def normalize_name(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def product_name(product):
    for key in ("name", "product_name", "card_name"):
        if product.get(key): return str(product[key])
    return ""


def build_direct_prices(products, target_ids):
    prices = {}; matched_products = 0
    for product in products:
        sid = product.get("scryfall_id")
        if not sid or str(sid) not in target_ids: continue
        product_prices = condition_prices(product)
        if not product_prices: continue
        matched_products += 1; sid = str(sid); finish = finish_for_product(product)
        finish_prices = prices.setdefault(sid, {}).setdefault(finish, {})
        for condition, price in product_prices.items():
            current = finish_prices.get(condition)
            if current is None or price < current: finish_prices[condition] = price
    print(f"CK products matching our catalog: {matched_products:,}")
    print(f"Scryfall printings with direct CK price: {len(prices):,}")
    return prices


def print_finish_diagnostics(products, target_cards):
    print("\nCARD KINGDOM FINISH DIAGNOSTICS")
    print("================================")
    wanted_ids = {
        sid for sid, card in target_cards.items()
        if normalize_name(card.get("name")) in {normalize_name(name) for name in FINISH_DIAGNOSTIC_NAMES}
    }
    found = 0
    for product in products:
        sid = str(product.get("scryfall_id") or "")
        name = normalize_name(product_name(product))
        if sid not in wanted_ids and name not in {normalize_name(value) for value in FINISH_DIAGNOSTIC_NAMES}:
            continue
        found += 1
        print("\n------------------------------------------------------------")
        print(f"Product name: {product_name(product)}")
        print(f"Scryfall ID: {product.get('scryfall_id')}")
        print(f"Current detected finish: {finish_for_product(product)}")
        print(f"Condition prices: {condition_prices(product)}")
        print("Raw CK product fields:")
        for key in sorted(product.keys()):
            value = product.get(key)
            if isinstance(value, (dict, list)):
                print(f"  {key}: {json.dumps(value, ensure_ascii=False, sort_keys=True)}")
            else:
                print(f"  {key}: {value}")
    if not found:
        print("No matching CK products found for finish diagnostic targets.")
    print("\nEND CARD KINGDOM FINISH DIAGNOSTICS\n")


def print_unresolved_diagnostics(products, target_cards, prices):
    missing = [card for sid, card in target_cards.items() if sid not in prices]
    print("\nCARD KINGDOM UNRESOLVED DIAGNOSTICS")
    print("==================================")
    print(f"Printings without exact CK Scryfall match: {len(missing):,}")
    if not missing:
        print("All catalog printings resolved."); return
    by_name = defaultdict(list)
    for product in products:
        name = normalize_name(product_name(product))
        if name: by_name[name].append(product)
    for card in missing:
        sid = str(card.get("scryfall_id") or "")
        name = str(card.get("name") or "")
        candidates = by_name.get(normalize_name(name), [])
        print("\n------------------------------------------------------------")
        print(f"Name: {name}")
        print(f"Set / Collector: {str(card.get('set_code') or '').upper()} / {card.get('collector_number')}")
        print(f"Scryfall ID: {sid}")
        print(f"CK candidates with exact normalized name: {len(candidates)}")
        if not candidates:
            print("Reason: no CK product with the same normalized card name was found in the feed.")
            continue
        for index, product in enumerate(candidates[:12], 1):
            prices_for_product = condition_prices(product)
            interesting = {key: product.get(key) for key in ("id","url","name","product_name","card_name","scryfall_id","is_foil","edition","set_name","set_code","collector_number") if product.get(key) is not None}
            print(f"  Candidate {index}: {interesting}")
            print(f"    finish={finish_for_product(product)} prices={prices_for_product}")
        if len(candidates) > 12: print(f"  ... {len(candidates)-12} additional candidate(s) omitted")
        exact_other = [p for p in candidates if p.get("scryfall_id")]
        if exact_other: print("Reason: CK has same-name products, but their Scryfall ID does not equal this exact printing (or the exact product has no usable price).")
        else: print("Reason: CK has same-name products but does not expose a Scryfall ID for these candidates.")
    print("\nEND CARD KINGDOM UNRESOLVED DIAGNOSTICS\n")


def chunked(values, size):
    values=list(values)
    for start in range(0,len(values),size): yield values[start:start+size]


def patch_legacy_card_prices(prices,timestamp):
    normal_count=foil_count=0
    for sid,finishes in prices.items():
        payload={"cardkingdom_price_updated_at":timestamp}; nonfoil_nm=finishes.get("nonfoil",{}).get("NM"); foil_nm=finishes.get("foil",{}).get("NM")
        if nonfoil_nm is not None: payload["cardkingdom_normal_usd"]=nonfoil_nm; normal_count+=1
        if foil_nm is not None: payload["cardkingdom_foil_usd"]=foil_nm; foil_count+=1
        if len(payload)==1: continue
        encoded=urllib.parse.quote(sid,safe="")
        supabase_request("PATCH",f"cards?scryfall_id=eq.{encoded}",payload,{"Prefer":"return=minimal"})
    return normal_count,foil_count


def build_card_price_rows(prices,timestamp):
    return [{"scryfall_id":sid,"source":"cardkingdom","finish":finish,"condition":condition,"price_usd":price,"updated_at":timestamp} for sid,finishes in prices.items() for finish,conditions in finishes.items() for condition,price in conditions.items()]


def upsert_condition_prices(rows):
    updated=0
    for batch in chunked(rows,UPSERT_BATCH_SIZE):
        supabase_request("POST","card_prices?on_conflict=scryfall_id,source,finish,condition",batch,{"Prefer":"resolution=merge-duplicates,return=minimal"}); updated+=len(batch)
    return updated


def sync(prices):
    timestamp=datetime.now(timezone.utc).replace(microsecond=0).isoformat(); print("Syncing Card Kingdom condition prices to Supabase...")
    rows=build_card_price_rows(prices,timestamp); condition_count=upsert_condition_prices(rows); normal_count,foil_count=patch_legacy_card_prices(prices,timestamp)
    counts={condition:0 for condition in CK_CONDITION_FIELDS}
    for row in rows: counts[row["condition"]]+=1
    print(f"Condition price rows upserted: {condition_count:,}")
    for condition in ("NM","EX","VG","G"): print(f"  {condition}: {counts[condition]:,}")
    print(f"Legacy CK normal NM prices updated: {normal_count:,}"); print(f"Legacy CK foil NM prices updated:   {foil_count:,}")
    print("Etched and surgefoil remain unchanged until CK exposes a reliable finish signal.")


def print_validation(prices):
    sid="09ecd919-6f99-47fd-8242-b0b062e98b45"
    if sid not in prices: print("Validation case The Irencrag: no direct CK match"); return
    print("Validation case: The Irencrag"); print(f"  Scryfall ID: {sid}")
    for finish in ("nonfoil","foil"):
        values=prices[sid].get(finish,{}); print(f"  {finish}:")
        for condition in ("NM","EX","VG","G"): print(f"    {condition}: {values.get(condition)}")


def main():
    require_environment(); target_cards=fetch_target_cards(); target_ids=set(target_cards)
    if not target_ids: print("No cards exist in public.cards. Nothing to update."); return
    products=fetch_cardkingdom_pricelist(); prices=build_direct_prices(products,target_ids)
    print_validation(prices); print_finish_diagnostics(products,target_cards); print_unresolved_diagnostics(products,target_cards,prices); sync(prices)
    missing=len(target_ids-set(prices)); print(f"Catalog printings without a direct CK match: {missing:,}"); print("Direct Card Kingdom condition-price synchronization completed successfully.")


if __name__ == "__main__": main()
