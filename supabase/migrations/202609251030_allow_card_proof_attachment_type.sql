-- Order flow v3 hotfix: card evidence uploaded during inventory confirmation
-- must be a first-class order attachment type.

alter table public.order_attachments
  drop constraint if exists order_attachments_attachment_type_check;

alter table public.order_attachments
  add constraint order_attachments_attachment_type_check
  check (attachment_type = any (array[
    'card_proof'::text,
    'payment_proof'::text,
    'package_proof'::text,
    'shipment_proof'::text,
    'other'::text
  ]));

comment on column public.order_attachments.attachment_type is
'Order evidence type. card_proof = seller photos of actual cards before inventory confirmation; package_proof = prepared package; payment_proof = buyer payment receipt. shipment_proof/other remain for historical compatibility.';
