# Catalog routing

## Canonical seller inventory routes

- `/catalog` — inventory root. Shows Binders, Sealed Products, and Other Products.
- `/catalog/binders/[id]` — card inventory for exactly one Binder.

## Legacy compatibility routes

- `/catalog/singles` redirects to `/catalog`.
- `/catalog/singles/binders/[id]` redirects to `/catalog/binders/[id]`.
- `?binder=` is not a routing mechanism and must not be used by catalog components.

## Rules

1. `/catalog` never renders a Binder card inventory.
2. Binder inventory is loaded only from the route parameter in `/catalog/binders/[id]`.
3. Internal Binder navigation returns directly to `/catalog`.
4. Sealed Products and Other Products remain independent inventory families and must not depend on Binder logic.
