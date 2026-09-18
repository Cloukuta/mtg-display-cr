# Catalog Binder initial render flash

## Symptom
Opening `/catalog?binder=<id>` briefly displayed cards from the seller's full inventory before Binder scoping was applied. This looked like a visual crash/flicker to the user.

## Cause
The catalog page renders the seller inventory before `CatalogBinderNavigation` finishes loading the selected Binder inventory and applies the Binder scope. PR #26 kept that scope correct after rerenders, but the first paint could still expose the unscoped catalog.

## Fix
- Add an explicit Binder loading/preparing state that covers the catalog before unscoped inventory can be exposed.
- Apply the initial Binder scope in `useLayoutEffect`, before the browser paints the ready Binder view.
- Only remove the transition state after the Binder title, cards and counters have been scoped.
- Preserve the PR #26 rerender guard so catalog filters cannot reintroduce cards from another Binder.

## Follow-up architecture
The long-term simplification is to make the catalog inventory query itself accept `binder_id`, so the page never fetches unrelated Binder rows. The current fix removes the user-visible flash without changing the existing catalog/filter behavior in this hotfix.
