# Mobile Binder V2 regression checklist

This PR changes only responsive presentation for Binder inventory and bulk actions.

## Mobile (<= 640px)
- Card row follows V2 layout: checkbox + thumbnail + identity/details on the first row.
- Card Kingdom and sale price appear below the identity row, spanning the card content area.
- Card name remains clickable and opens the existing inventory editor.
- Selecting cards keeps the bulk action panel fixed at the bottom of the viewport.
- Bulk actions use a compact 2x2 grid and remain tappable.
- Safe-area inset is respected on devices with a home indicator.
- Last inventory rows remain reachable while the floating panel is visible.

## Desktop
- Existing desktop card layout remains unchanged.
- Existing bulk action behavior remains unchanged.

## Functional regression
- Selection and multi-selection still work.
- Default, Custom, Discount and Remove actions still work.
- Trade Binder and custom Binders use the same responsive treatment.
- No pricing, Supabase, Binder assignment, filtering, or routing logic is changed.
