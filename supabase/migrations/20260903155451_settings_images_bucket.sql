insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('settings-images', 'settings-images', true, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'], 5242880)
on conflict (id) do nothing;

create policy "public read settings images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'settings-images');

create policy "admins with configuracion editar manage settings image files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'settings-images'
  and public.has_permission(auth.uid(), 'configuracion', 'editar')
)
with check (
  bucket_id = 'settings-images'
  and public.has_permission(auth.uid(), 'configuracion', 'editar')
);
