# P1.6 cache health hotfix

The cache health check must URL-encode the complete PostgREST `updated_at` filter value.

An ISO-8601 UTC timestamp contains a `+00:00` offset. If `+` is left unescaped in a query string, it may be decoded as a space, making the `timestamptz` filter invalid and causing PostgREST to return HTTP 400.

The health check now encodes `lt.<timestamp>` as one query value and reports the Supabase response body when an HTTP error occurs.
