# Private route guard plan

The client-side `AuthGuard` is intended for account-owned surfaces only. Public marketplace routes remain accessible to guests.

Protected surfaces audited for this phase:
- /dashboard
- /catalog and /catalog/**
- /import
- /pending-sales
- /orders and /orders/**
- /profile
- /settings/**
- /checkout/**

Public surfaces remain:
- /
- /v/**
- /login

Supabase RLS remains the security boundary for database writes; the route guard prevents confusing direct-URL access in the UI.
