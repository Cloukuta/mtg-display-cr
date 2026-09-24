# Exact collector deeplink regression

Regression case from seller display:

- URL: `/v/cloukuta-store?set=SLZ&collector=349`
- Expected: only `SLZ #349` is visible.
- Must not show another printing with the same card name and set, such as `SLZ #107`.
- Manual seller-catalog searches remain unchanged and may show multiple printings.
- Legacy `?card=<scryfall_id>` links remain supported and canonicalize to Set + Collector.

This hotfix intentionally does not add `finish` to the public printing key yet. Set + Collector is the exact-printing discriminator under test.
