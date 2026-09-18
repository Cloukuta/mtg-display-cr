# Catalog routing legacy cleanup

## Symptom

Opening a Binder from `/catalog` could return the seller to the inventory root or render old Binder components instead of the selected Binder inventory.

## Root cause

The canonical `/catalog/binders/[id]` route was only re-exporting the implementation stored under the legacy `/catalog/singles/binders/[id]` route. That legacy implementation also linked back through `/catalog/singles`, so the new routing hierarchy still depended on the old hierarchy.

## Fix

- Move the real Binder inventory implementation to `/catalog/binders/[id]`.
- Make `/catalog/singles/binders/[id]` redirect-only.
- Keep `/catalog/singles` redirect-only.
- Make Binder back/navigation links target `/catalog` directly.
- Do not use `?binder=` for routing.

## Regression test

1. Open `/catalog` and confirm it shows the inventory hierarchy.
2. Open Trade Binder and confirm URL `/catalog/binders/1` renders its cards.
3. Return to `/catalog`.
4. Open a custom Binder and confirm only its cards render.
5. Open `/catalog/singles/binders/1` directly and confirm it redirects to `/catalog/binders/1`.
6. Open `/catalog?binder=1` and confirm the query does not select/open a Binder.
