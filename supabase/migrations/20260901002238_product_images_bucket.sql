insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "public read product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "admins with productos editar manage product image files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'product-images'
  and public.has_permission(auth.uid(), 'productos', 'editar')
)
with check (
  bucket_id = 'product-images'
  and public.has_permission(auth.uid(), 'productos', 'editar')
);
