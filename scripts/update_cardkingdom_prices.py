import gzip
import json
import os
import tempfile
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

import ijson

MTGJSON_BASE = "https://mtgjson.com/api/v5"
IDENTIFIERS_URL = f"{MTGJSON_BASE}/AllIdentifiers.json.gz"
PRICES_URL = f"{MTGJSON_BASE}/AllPricesToday.json.gz"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


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
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = response.read()
            return json.loads(body.decode("utf-8")) if body else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path} failed ({exc.code}): {body}") from exc


def fetch_target_scryfall_ids():
    print("Reading existing Scryfall IDs from Supabase...")
    result = set()
    offset = 0
    page_size = 1000

    while True:
        rows = supabase_request(
            "GET",
            f"cards?select=scryfall_id&order=scryfall_id&limit={page_size}&offset={offset}",
        ) or []
        for row in rows:
            value = row.get("scryfall_id")
            if value:
                result.add(str(value))
        if len(rows) < page_size:
            break
        offset += page_size

    print(f"Target Scryfall printings: {len(result):,}")
    return result


def download(url, destination):
    print(f"Downloading: {url}")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "mtg-display-cr/1.0 (GitHub price updater)"},
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        with open(destination, "wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
    print(f"Saved: {destination}")


def latest_price(points):
    if not points:
        return None
    valid = []
    for date, value in points.items():
        try:
            price = float(value)
        except (TypeError, ValueError):
            continue
        valid.append((str(date), price))
    if not valid:
        return None
    valid.sort(key=lambda item: item[0])
    date, price = valid[-1]
    return {"price": round(price, 2), "date": date}


def choose_newer_price(existing, candidate):
    if candidate is None:
        return existing
    if existing is None:
        return candidate
    if str(candidate.get("date", "")) > str(existing.get("date", "")):
        return candidate
    return existing


def build_identifier_index(identifier_file, target_scryfall_ids):
    print("Building targeted identifier index...")
    cards = {}
    ck_normal_to_uuids = defaultdict(set)
    ck_foil_to_uuids = defaultdict(set)
    ck_etched_to_uuids = defaultdict(set)
    target_ck_normal_ids = set()
    target_ck_foil_ids = set()
    target_ck_etched_ids = set()
    target_counterpart_uuids = set()

    # Pass 1: retain only exact target Scryfall printings.
    with gzip.open(identifier_file, "rb") as file:
        for uuid, card in ijson.kvitems(file, "data"):
            identifiers = card.get("identifiers") or {}
            scryfall_id = identifiers.get("scryfallId")
            if scryfall_id not in target_scryfall_ids:
                continue

            card_data = {
                "uuid": uuid,
                "scryfall_id": scryfall_id,
                "ck_normal_id": identifiers.get("cardKingdomId"),
                "ck_foil_id": identifiers.get("cardKingdomFoilId"),
                "ck_etched_id": identifiers.get("cardKingdomEtchedId"),
                "nonfoil_uuid": identifiers.get("mtgjsonNonFoilVersionId"),
                "foil_uuid": identifiers.get("mtgjsonFoilVersionId"),
            }
            cards[uuid] = card_data

            if card_data["ck_normal_id"]:
                target_ck_normal_ids.add(str(card_data["ck_normal_id"]))
            if card_data["ck_foil_id"]:
                target_ck_foil_ids.add(str(card_data["ck_foil_id"]))
            if card_data["ck_etched_id"]:
                target_ck_etched_ids.add(str(card_data["ck_etched_id"]))
            if card_data["nonfoil_uuid"]:
                target_counterpart_uuids.add(card_data["nonfoil_uuid"])
            if card_data["foil_uuid"]:
                target_counterpart_uuids.add(card_data["foil_uuid"])

    # Pass 2: find UUIDs explicitly sharing the target CK product IDs.
    with gzip.open(identifier_file, "rb") as file:
        for uuid, card in ijson.kvitems(file, "data"):
            identifiers = card.get("identifiers") or {}
            normal_id = identifiers.get("cardKingdomId")
            foil_id = identifiers.get("cardKingdomFoilId")
            etched_id = identifiers.get("cardKingdomEtchedId")
            if normal_id and str(normal_id) in target_ck_normal_ids:
                ck_normal_to_uuids[str(normal_id)].add(uuid)
            if foil_id and str(foil_id) in target_ck_foil_ids:
                ck_foil_to_uuids[str(foil_id)].add(uuid)
            if etched_id and str(etched_id) in target_ck_etched_ids:
                ck_etched_to_uuids[str(etched_id)].add(uuid)

    relevant_uuids = set(cards.keys()) | target_counterpart_uuids
    for values in ck_normal_to_uuids.values():
        relevant_uuids.update(values)
    for values in ck_foil_to_uuids.values():
        relevant_uuids.update(values)
    for values in ck_etched_to_uuids.values():
        relevant_uuids.update(values)

    print(f"Matched target MTGJSON records: {len(cards):,}")
    print(f"Relevant price UUIDs: {len(relevant_uuids):,}")
    return {
        "cards": cards,
        "ck_normal_to_uuids": ck_normal_to_uuids,
        "ck_foil_to_uuids": ck_foil_to_uuids,
        "ck_etched_to_uuids": ck_etched_to_uuids,
        "relevant_uuids": relevant_uuids,
    }


def load_cardkingdom_prices(price_file, relevant_uuids):
    print("Loading Card Kingdom retail prices for relevant UUIDs...")
    result = {}
    with gzip.open(price_file, "rb") as file:
        for uuid, formats in ijson.kvitems(file, "data"):
            if uuid not in relevant_uuids:
                continue
            paper = formats.get("paper") or {}
            cardkingdom = paper.get("cardkingdom") or {}
            retail = cardkingdom.get("retail") or {}
            normal = latest_price(retail.get("normal"))
            foil = latest_price(retail.get("foil"))
            etched = latest_price(retail.get("etched"))
            if any((normal, foil, etched)):
                result[uuid] = {
                    "normal": normal,
                    "foil": foil,
                    "etched": etched,
                }
    print(f"Relevant UUIDs with CK prices: {len(result):,}")
    return result


def get_uuid_price(raw_prices, uuid, finish):
    if not uuid:
        return None
    record = raw_prices.get(uuid)
    return record.get(finish) if record else None


def price_from_candidate_uuids(raw_prices, uuids, finish):
    result = None
    for uuid in uuids:
        result = choose_newer_price(result, get_uuid_price(raw_prices, uuid, finish))
    return result


def resolve_normal_price(card, raw_prices, index):
    price = get_uuid_price(raw_prices, card["uuid"], "normal")
    if price:
        return price
    price = get_uuid_price(raw_prices, card.get("nonfoil_uuid"), "normal")
    if price:
        return price
    ck_id = card.get("ck_normal_id")
    if ck_id:
        return price_from_candidate_uuids(
            raw_prices,
            index["ck_normal_to_uuids"].get(str(ck_id), set()),
            "normal",
        )
    return None


def resolve_foil_price(card, raw_prices, index):
    price = get_uuid_price(raw_prices, card["uuid"], "foil")
    if price:
        return price
    foil_uuid = card.get("foil_uuid")
    price = get_uuid_price(raw_prices, foil_uuid, "foil")
    if price:
        return price
    # Guarded fallback retained from mtg-collection-manager.
    price = get_uuid_price(raw_prices, foil_uuid, "normal")
    if price:
        return price
    ck_id = card.get("ck_foil_id")
    if ck_id:
        candidates = index["ck_foil_to_uuids"].get(str(ck_id), set())
        price = price_from_candidate_uuids(raw_prices, candidates, "foil")
        if price:
            return price
        return price_from_candidate_uuids(raw_prices, candidates, "normal")
    return None


def resolve_etched_price(card, raw_prices, index):
    price = get_uuid_price(raw_prices, card["uuid"], "etched")
    if price:
        return price
    ck_id = card.get("ck_etched_id")
    if ck_id:
        return price_from_candidate_uuids(
            raw_prices,
            index["ck_etched_to_uuids"].get(str(ck_id), set()),
            "etched",
        )
    return None


def build_updates(index, raw_prices):
    by_scryfall = {}
    for card in index["cards"].values():
        scryfall_id = card["scryfall_id"]
        record = by_scryfall.setdefault(
            scryfall_id,
            {"normal": None, "foil": None, "etched": None},
        )
        record["normal"] = choose_newer_price(
            record["normal"], resolve_normal_price(card, raw_prices, index)
        )
        record["foil"] = choose_newer_price(
            record["foil"], resolve_foil_price(card, raw_prices, index)
        )
        record["etched"] = choose_newer_price(
            record["etched"], resolve_etched_price(card, raw_prices, index)
        )
    return by_scryfall


def sync_to_supabase(updates):
    print("Syncing prices to Supabase...")
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    for scryfall_id, prices in updates.items():
        if not any(prices.values()):
            skipped += 1
            continue

        payload = {
            "cardkingdom_normal_usd": prices["normal"]["price"] if prices["normal"] else None,
            "cardkingdom_foil_usd": prices["foil"]["price"] if prices["foil"] else None,
            "cardkingdom_etched_usd": prices["etched"]["price"] if prices["etched"] else None,
            "cardkingdom_price_updated_at": now,
        }
        encoded_id = urllib.parse.quote(scryfall_id, safe="")
        supabase_request(
            "PATCH",
            f"cards?scryfall_id=eq.{encoded_id}",
            payload,
            {"Prefer": "return=minimal"},
        )
        updated += 1

    print(f"Updated Supabase cards: {updated:,}")
    print(f"Cards without CK prices: {skipped:,}")


def main():
    require_environment()
    target_ids = fetch_target_scryfall_ids()
    if not target_ids:
        print("No cards exist in public.cards yet. Nothing to update.")
        return

    with tempfile.TemporaryDirectory() as temp:
        identifiers_file = os.path.join(temp, "AllIdentifiers.json.gz")
        prices_file = os.path.join(temp, "AllPricesToday.json.gz")
        download(IDENTIFIERS_URL, identifiers_file)
        download(PRICES_URL, prices_file)
        index = build_identifier_index(identifiers_file, target_ids)
        raw_prices = load_cardkingdom_prices(prices_file, index["relevant_uuids"])
        updates = build_updates(index, raw_prices)
        sync_to_supabase(updates)

    print("Card Kingdom price update completed successfully.")


if __name__ == "__main__":
    main()
