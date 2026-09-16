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
        headers={"User-Agent": "mtg-display-cr/1.1 (GitHub price updater)"},
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


def normalize_finish(value):
    value = str(value or "").strip().lower()
    if value in {"nonfoil", "normal"}:
        return "normal"
    if value == "foil":
        return "foil"
    if value == "etched":
        return "etched"
    return None


def build_identifier_index(identifier_file, target_scryfall_ids):
    print("Building targeted identifier index...")
    cards = {}
    target_ck_ids = {"normal": set(), "foil": set(), "etched": set()}
    ck_to_uuids = {
        "normal": defaultdict(set),
        "foil": defaultdict(set),
        "etched": defaultdict(set),
    }
    target_counterpart_uuids = set()

    # Pass 1: keep exact Scryfall targets and all known finish counterpart UUIDs.
    with gzip.open(identifier_file, "rb") as file:
        for uuid, card in ijson.kvitems(file, "data"):
            identifiers = card.get("identifiers") or {}
            scryfall_id = identifiers.get("scryfallId")
            if scryfall_id not in target_scryfall_ids:
                continue

            finishes = {
                finish
                for finish in (normalize_finish(value) for value in (card.get("finishes") or []))
                if finish
            }
            card_data = {
                "uuid": uuid,
                "scryfall_id": scryfall_id,
                "name": card.get("name"),
                "set_code": card.get("setCode"),
                "number": card.get("number"),
                "finishes": finishes,
                "ck_ids": {
                    "normal": identifiers.get("cardKingdomId"),
                    "foil": identifiers.get("cardKingdomFoilId"),
                    "etched": identifiers.get("cardKingdomEtchedId"),
                },
                "counterparts": {
                    "normal": identifiers.get("mtgjsonNonFoilVersionId"),
                    "foil": identifiers.get("mtgjsonFoilVersionId"),
                },
            }
            cards[uuid] = card_data

            for finish, ck_id in card_data["ck_ids"].items():
                if ck_id:
                    target_ck_ids[finish].add(str(ck_id))
            for counterpart_uuid in card_data["counterparts"].values():
                if counterpart_uuid:
                    target_counterpart_uuids.add(counterpart_uuid)

    # Pass 2: build CK product-ID mappings and capture metadata for counterpart UUIDs.
    counterpart_meta = {}
    with gzip.open(identifier_file, "rb") as file:
        for uuid, card in ijson.kvitems(file, "data"):
            identifiers = card.get("identifiers") or {}
            normal_id = identifiers.get("cardKingdomId")
            foil_id = identifiers.get("cardKingdomFoilId")
            etched_id = identifiers.get("cardKingdomEtchedId")

            if normal_id and str(normal_id) in target_ck_ids["normal"]:
                ck_to_uuids["normal"][str(normal_id)].add(uuid)
            if foil_id and str(foil_id) in target_ck_ids["foil"]:
                ck_to_uuids["foil"][str(foil_id)].add(uuid)
            if etched_id and str(etched_id) in target_ck_ids["etched"]:
                ck_to_uuids["etched"][str(etched_id)].add(uuid)

            if uuid in target_counterpart_uuids:
                counterpart_meta[uuid] = {
                    "uuid": uuid,
                    "ck_ids": {
                        "normal": normal_id,
                        "foil": foil_id,
                        "etched": etched_id,
                    },
                    "counterparts": {
                        "normal": identifiers.get("mtgjsonNonFoilVersionId"),
                        "foil": identifiers.get("mtgjsonFoilVersionId"),
                    },
                }

    # Expand relevant UUIDs with CK-linked UUIDs discovered from counterpart metadata.
    # This fixes printings where the target Scryfall record is the foil representation
    # but the nonfoil CK price lives on its linked MTGJSON counterpart (and vice versa).
    extra_ck_ids = {"normal": set(), "foil": set(), "etched": set()}
    second_level_counterparts = set()
    for meta in counterpart_meta.values():
        for finish, ck_id in meta["ck_ids"].items():
            if ck_id:
                extra_ck_ids[finish].add(str(ck_id))
        for counterpart_uuid in meta["counterparts"].values():
            if counterpart_uuid:
                second_level_counterparts.add(counterpart_uuid)

    if any(extra_ck_ids.values()):
        with gzip.open(identifier_file, "rb") as file:
            for uuid, card in ijson.kvitems(file, "data"):
                identifiers = card.get("identifiers") or {}
                for finish, field in (
                    ("normal", "cardKingdomId"),
                    ("foil", "cardKingdomFoilId"),
                    ("etched", "cardKingdomEtchedId"),
                ):
                    ck_id = identifiers.get(field)
                    if ck_id and str(ck_id) in extra_ck_ids[finish]:
                        ck_to_uuids[finish][str(ck_id)].add(uuid)

    relevant_uuids = set(cards.keys()) | target_counterpart_uuids | second_level_counterparts
    for finish_map in ck_to_uuids.values():
        for values in finish_map.values():
            relevant_uuids.update(values)

    print(f"Matched target MTGJSON records: {len(cards):,}")
    print(f"Known finish counterpart UUIDs: {len(target_counterpart_uuids):,}")
    print(f"Relevant price UUIDs: {len(relevant_uuids):,}")
    return {
        "cards": cards,
        "counterpart_meta": counterpart_meta,
        "ck_to_uuids": ck_to_uuids,
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


def price_from_candidate_uuids(raw_prices, uuids, finishes):
    result = None
    for uuid in uuids:
        for finish in finishes:
            result = choose_newer_price(result, get_uuid_price(raw_prices, uuid, finish))
    return result


def resolve_via_ck_id(card, finish, raw_prices, index):
    ck_id = card.get("ck_ids", {}).get(finish)
    if not ck_id:
        return None
    candidates = index["ck_to_uuids"][finish].get(str(ck_id), set())
    # MTGJSON can store a finish-specific CK product under a normal bucket on a
    # finish-specific UUID, so the second bucket is a guarded product-ID fallback.
    buckets = (finish, "normal") if finish != "normal" else ("normal",)
    return price_from_candidate_uuids(raw_prices, candidates, buckets)


def resolve_from_counterpart(card, desired_finish, raw_prices, index):
    counterpart_uuid = card.get("counterparts", {}).get(desired_finish)
    if not counterpart_uuid:
        return None

    # Exact counterpart UUID first.
    price = get_uuid_price(raw_prices, counterpart_uuid, desired_finish)
    if price:
        return price
    if desired_finish != "normal":
        price = get_uuid_price(raw_prices, counterpart_uuid, "normal")
        if price:
            return price

    # Then use the counterpart's own finish-specific CK product ID.
    meta = index["counterpart_meta"].get(counterpart_uuid)
    if not meta:
        return None
    ck_id = meta.get("ck_ids", {}).get(desired_finish)
    if not ck_id:
        return None
    candidates = index["ck_to_uuids"][desired_finish].get(str(ck_id), set())
    buckets = (desired_finish, "normal") if desired_finish != "normal" else ("normal",)
    return price_from_candidate_uuids(raw_prices, candidates, buckets)


def resolve_price(card, finish, raw_prices, index):
    # 1. Exact MTGJSON UUID / exact finish.
    price = get_uuid_price(raw_prices, card["uuid"], finish)
    if price:
        return price

    # 2. Explicit MTGJSON finish counterpart.
    if finish in {"normal", "foil"}:
        price = resolve_from_counterpart(card, finish, raw_prices, index)
        if price:
            return price

    # 3. Explicit Card Kingdom product ID for this finish.
    price = resolve_via_ck_id(card, finish, raw_prices, index)
    if price:
        return price

    # 4. For finish-specific target UUIDs, MTGJSON sometimes puts that CK price
    #    in the normal bucket. Only use this when a finish-specific CK ID exists.
    if finish != "normal" and card.get("ck_ids", {}).get(finish):
        price = get_uuid_price(raw_prices, card["uuid"], "normal")
        if price:
            return price

    return None


def build_updates(index, raw_prices):
    by_scryfall = {}
    for card in index["cards"].values():
        scryfall_id = card["scryfall_id"]
        record = by_scryfall.setdefault(
            scryfall_id,
            {"normal": None, "foil": None, "etched": None, "expected": set()},
        )
        record["expected"].update(card.get("finishes") or set())
        for finish in ("normal", "foil", "etched"):
            record[finish] = choose_newer_price(
                record[finish], resolve_price(card, finish, raw_prices, index)
            )
    return by_scryfall


def print_diagnostics(updates):
    print("\nPrice resolution diagnostics")
    print("----------------------------")
    total = len(updates)
    resolved = {
        finish: sum(1 for row in updates.values() if row.get(finish))
        for finish in ("normal", "foil", "etched")
    }
    expected_missing = {
        finish: sum(
            1
            for row in updates.values()
            if finish in row.get("expected", set()) and not row.get(finish)
        )
        for finish in ("normal", "foil", "etched")
    }
    print(f"Target printings resolved: {total:,}")
    print(f"CK normal resolved:        {resolved['normal']:,}")
    print(f"CK foil resolved:          {resolved['foil']:,}")
    print(f"CK etched resolved:        {resolved['etched']:,}")
    print(f"Expected normal but null:  {expected_missing['normal']:,}")
    print(f"Expected foil but null:    {expected_missing['foil']:,}")
    print(f"Expected etched but null:  {expected_missing['etched']:,}")

    test_id = "09ecd919-6f99-47fd-8242-b0b062e98b45"
    if test_id in updates:
        row = updates[test_id]
        print("\nValidation case: The Irencrag")
        print(f"  Scryfall ID: {test_id}")
        print(f"  normal: {row['normal']['price'] if row['normal'] else None}")
        print(f"  foil:   {row['foil']['price'] if row['foil'] else None}")
        print(f"  etched: {row['etched']['price'] if row['etched'] else None}")


def sync_to_supabase(updates):
    print("\nSyncing prices to Supabase...")
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    for scryfall_id, prices in updates.items():
        if not any(prices.get(finish) for finish in ("normal", "foil", "etched")):
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
    print(f"Cards without any CK price: {skipped:,}")


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
        print_diagnostics(updates)
        sync_to_supabase(updates)

    print("Card Kingdom price update completed successfully.")


if __name__ == "__main__":
    main()
