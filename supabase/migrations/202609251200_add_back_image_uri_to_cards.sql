-- Double-faced card support.
-- image_uri remains the canonical/front face for backwards compatibility.
-- back_image_uri stores the second printable face when Scryfall exposes one.

alter table public.cards
  add column if not exists back_image_uri text;

comment on column public.cards.back_image_uri is
'Scryfall image URL for the second/back face of a double-faced card. NULL for single-faced cards.';
