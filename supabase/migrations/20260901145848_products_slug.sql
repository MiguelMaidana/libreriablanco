alter table public.products add column slug text unique;

create or replace view public.public_products
with (security_barrier = true)
as
select
  id, internal_code, sku, barcode, isbn, name, short_description, full_description,
  brand, publisher, author, category_id, tags, price, sale_price,
  available, is_published, is_featured, featured_order, is_new, created_at, slug
from public.products
where is_published = true and available = true;

-- CREATE OR REPLACE VIEW conserva el owner/ACL existente, pero se
-- reafirman los grants explícitamente (defensa en profundidad, mismo
-- criterio que Fase 1a/1b): esta vista nunca debe aceptar escritura.
revoke all on public.public_products from anon, authenticated, service_role, public;
grant select on public.public_products to anon, authenticated;
