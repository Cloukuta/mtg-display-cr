# Issue #79 regression checks

- Published seller with zero available inventory items: hidden from Explore Sellers.
- Published seller with only `quantity = 0` items: hidden from Explore Sellers.
- Published seller with at least one `available = true` and `quantity > 0` item: visible.
- Removing/selling the last available item hides the seller on the next catalog load.
- Global catalog delivery-point filtering remains independent from Explore Sellers visibility.
