-- Structured buyer feedback after receipt confirmation.
-- Keeps the existing 1-5 rating/comment while adding quick marketplace-specific signals.

alter table public.order_reviews
  add column if not exists feedback_tags text[] not null default '{}'::text[];

alter table public.order_reviews
  drop constraint if exists order_reviews_feedback_tags_allowed;

alter table public.order_reviews
  add constraint order_reviews_feedback_tags_allowed
  check (
    feedback_tags <@ array[
      'responds_quickly',
      'good_communication',
      'accurate_description',
      'well_packaged',
      'on_time_delivery'
    ]::text[]
  );

create or replace function public.submit_order_review(
  p_order_id bigint,
  p_rating integer,
  p_comment text default null,
  p_feedback_tags text[] default '{}'::text[]
)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_order public.orders%rowtype;
  v_review_id bigint;
  v_tags text[]:=coalesce(p_feedback_tags,'{}'::text[]);
  v_allowed constant text[]:=array[
    'responds_quickly',
    'good_communication',
    'accurate_description',
    'well_packaged',
    'on_time_delivery'
  ];
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_rating<1 or p_rating>5 then raise exception 'INVALID_RATING'; end if;
  if p_comment is not null and char_length(btrim(p_comment))>1000 then raise exception 'REVIEW_TOO_LONG'; end if;
  if not (v_tags <@ v_allowed) then raise exception 'INVALID_FEEDBACK_TAG'; end if;

  select * into v_order from public.orders where id=p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.buyer_id<>v_user then raise exception 'ORDER_ACCESS_DENIED'; end if;
  if v_order.status<>'completed' then raise exception 'ORDER_NOT_COMPLETED'; end if;
  if exists(select 1 from public.order_reviews r where r.order_id=p_order_id) then raise exception 'ORDER_ALREADY_REVIEWED'; end if;

  insert into public.order_reviews(order_id,buyer_id,seller_id,rating,comment,feedback_tags)
  values(p_order_id,v_user,v_order.seller_id,p_rating,nullif(btrim(p_comment),''),v_tags)
  returning id into v_review_id;

  insert into public.order_events(order_id,actor_id,actor_role,event_type,message)
  values(p_order_id,v_user,'buyer','seller_review_submitted','Buyer submitted seller rating and structured feedback.');

  return v_review_id;
end;
$$;

revoke all on function public.submit_order_review(bigint,integer,text,text[]) from public;
grant execute on function public.submit_order_review(bigint,integer,text,text[]) to authenticated;

comment on column public.order_reviews.feedback_tags is
'Optional buyer-selected seller feedback: responds_quickly, good_communication, accurate_description, well_packaged, on_time_delivery.';
