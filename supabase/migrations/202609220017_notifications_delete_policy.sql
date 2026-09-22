-- Notifications v1.1: users may delete only their own notifications.
-- Idempotent so it is safe to re-run.

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
on public.notifications
for delete
to authenticated
using (user_id = auth.uid());
