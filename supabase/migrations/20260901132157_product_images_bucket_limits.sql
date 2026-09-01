update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    file_size_limit = 5242880
where id = 'product-images';
