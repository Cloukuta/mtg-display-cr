# Public store menu auth hotfix

Cause: `/v/[slug]` mounts `AppMenu` directly, while Notifications v1.1 changed `AppMenu` to require `userId` and `authReady` supplied by `AppHeader`. Public seller displays use a custom header (cart + menu) and therefore never supplied those values, leaving the drawer permanently in `Cargando sesión…`.

Fix: `AppMenu` now supports both modes:
- controlled auth when mounted by `AppHeader`;
- standalone auth resolution when mounted directly by a public seller display.

In standalone mode the menu resolves the signed-in user's own profile, not the profile of the seller display currently being viewed. Logged-out visitors receive the guest menu.
