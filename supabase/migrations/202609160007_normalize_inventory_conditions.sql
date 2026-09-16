-- Normalize legacy/imported inventory conditions to the four condition grades
-- exposed by the Card Kingdom price feed: NM, EX, VG and G.
--
-- Existing historical inventory rows are preserved; only their condition label
-- is standardized so price resolution can use card_prices consistently.

update public.inventory_items
set condition = case
  when lower(trim(condition)) in ('near mint', 'nm') then 'NM'
  when lower(trim(condition)) in ('excellent', 'ex', 'lightly played', 'lp') then 'EX'
  when lower(trim(condition)) in ('very good', 'vg', 'moderately played', 'mp', 'played', 'pl') then 'VG'
  when lower(trim(condition)) in ('good', 'g', 'heavily played', 'hp', 'poor', 'po', 'damaged', 'dmg') then 'G'
  else condition
end,
updated_at = now()
where lower(trim(condition)) in (
  'near mint', 'nm',
  'excellent', 'ex', 'lightly played', 'lp',
  'very good', 'vg', 'moderately played', 'mp', 'played', 'pl',
  'good', 'g', 'heavily played', 'hp', 'poor', 'po', 'damaged', 'dmg'
)
and condition is distinct from case
  when lower(trim(condition)) in ('near mint', 'nm') then 'NM'
  when lower(trim(condition)) in ('excellent', 'ex', 'lightly played', 'lp') then 'EX'
  when lower(trim(condition)) in ('very good', 'vg', 'moderately played', 'mp', 'played', 'pl') then 'VG'
  when lower(trim(condition)) in ('good', 'g', 'heavily played', 'hp', 'poor', 'po', 'damaged', 'dmg') then 'G'
  else condition
end;
