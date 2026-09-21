-- Defense in depth for the free Storage tier.
-- Client-side compression will target substantially below this value; bucket rejects oversized originals.
update storage.buckets
set file_size_limit=1048576,
    allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[]
where id='order-attachments';
