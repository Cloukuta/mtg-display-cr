import os
import tempfile

import update_cardkingdom_prices as updater


def fmt_price(price):
    if not price:
        return None
    return price.get("price")


def main():
    updater.require_environment()
    target_ids = updater.fetch_target_scryfall_ids()
    if not target_ids:
        print("No cards exist in public.cards. Nothing to diagnose.")
        return

    with tempfile.TemporaryDirectory() as temp:
        identifiers_file = os.path.join(temp, "AllIdentifiers.json.gz")
        prices_file = os.path.join(temp, "AllPricesToday.json.gz")
        updater.download(updater.IDENTIFIERS_URL, identifiers_file)
        updater.download(updater.PRICES_URL, prices_file)
        index = updater.build_identifier_index(identifier_file, target_ids)
        raw_prices = updater.load_cardkingdom_prices(
            prices_file, index["relevant_uuids"]
        )
        updates = updater.build_updates(index, raw_prices)

        unresolved_ids = {
            scryfall_id
            for scryfall_id, row in updates.items()
            if "normal" in row.get("expected", set()) and not row.get("normal")
        }

        print("\nUNRESOLVED NORMAL DEBUG")
        print("=======================")
        print(f"Total unresolved expected-normal printings: {len(unresolved_ids)}")

        for scryfall_id in sorted(unresolved_ids):
            matching_cards = [
                card
                for card in index["cards"].values()
                if card.get("scryfall_id") == scryfall_id
            ]

            print("\n------------------------------------------------------------")
            print(f"Scryfall ID: {scryfall_id}")

            for card in matching_cards:
                print(f"Name: {card.get('name')}")
                print(f"Set / Collector: {card.get('set_code')} / {card.get('number')}")
                print(f"MTGJSON UUID: {card.get('uuid')}")
                print(f"Expected finishes: {sorted(card.get('finishes') or [])}")
                print(f"CK IDs: {card.get('ck_ids')}")
                print(f"Counterparts: {card.get('counterparts')}")

                exact = raw_prices.get(card.get("uuid")) or {}
                print(
                    "Exact UUID prices: "
                    f"normal={fmt_price(exact.get('normal'))}, "
                    f"foil={fmt_price(exact.get('foil'))}, "
                    f"etched={fmt_price(exact.get('etched'))}"
                )

                sibling_key = (
                    str(card.get("name") or "").strip().casefold(),
                    str(card.get("set_code") or "").strip().casefold(),
                    updater.normalize_collector_number(card.get("number")),
                )
                sibling_uuids = sorted(index["sibling_to_uuids"].get(sibling_key, set()))
                print(f"Sibling UUID count: {len(sibling_uuids)}")

                for sibling_uuid in sibling_uuids:
                    meta = index["sibling_meta"].get(sibling_uuid) or {}
                    prices = raw_prices.get(sibling_uuid) or {}
                    print(f"  Sibling UUID: {sibling_uuid}")
                    print(f"    Scryfall ID: {meta.get('scryfall_id')}")
                    print(f"    Set / Collector: {meta.get('set_code')} / {meta.get('number')}")
                    print(f"    Finishes: {sorted(meta.get('finishes') or [])}")
                    print(f"    CK IDs: {meta.get('ck_ids')}")
                    print(
                        "    Prices: "
                        f"normal={fmt_price(prices.get('normal'))}, "
                        f"foil={fmt_price(prices.get('foil'))}, "
                        f"etched={fmt_price(prices.get('etched'))}"
                    )

                normal_ck_id = card.get("ck_ids", {}).get("normal")
                if normal_ck_id:
                    ck_candidates = sorted(
                        index["ck_to_uuids"]["normal"].get(str(normal_ck_id), set())
                    )
                    print(f"CK normal candidate UUIDs: {ck_candidates}")
                else:
                    print("CK normal candidate UUIDs: [] (no normal CK ID on target record)")

        print("\nEND UNRESOLVED NORMAL DEBUG")


if __name__ == "__main__":
    main()
