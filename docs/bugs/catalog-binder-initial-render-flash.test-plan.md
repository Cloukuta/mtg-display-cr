# Regression test plan

1. Open `/catalog` and choose Trade Binder.
2. Confirm no cards from the full inventory flash before the Binder is ready.
3. Return to `/catalog` and open a smaller custom Binder.
4. Confirm only the selected Binder becomes visible after the short loading state.
5. Switch repeatedly between Trade Binder and the custom Binder.
6. Use All / Default / Custom / Discount, Set and Color filters after each switch.
7. Confirm no card from another Binder appears during initial load or subsequent rerenders.
8. Select cards and scroll; confirm the bulk action bar remains below the application header.
