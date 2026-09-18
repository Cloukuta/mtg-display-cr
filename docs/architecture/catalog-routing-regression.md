# Catalog route regression checks

- `/catalog` is the inventory root and does not open a Binder from a query string.
- `/catalog/binders/[id]` is the only Binder inventory implementation.
- `/catalog/singles` redirects to `/catalog`.
- `/catalog/singles/binders/[id]` redirects to `/catalog/binders/[id]`.
- Binder back links go directly to `/catalog`.
