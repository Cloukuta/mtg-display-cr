# Discount promotional UI

Discount presentation is driven exclusively by the existing resolved pricing data.

## Surfaces

`VisualPrice` is shared by Home, Global Catalog, and Seller Display. A resolved discount now renders:

- a prominent `-XX% OFF` badge positioned over the containing card artwork;
- the existing compact percentage indicator in the pricing detail;
- the CK USD reference on the USD face with sale treatment;
- the final seller CRC price on the CRC face.

## Pricing semantics

The Card Kingdom USD amount remains a **reference**, not a seller USD checkout price. The final sale amount continues to be the resolved CRC seller price. No database fields or pricing calculations are changed by this UI treatment.
