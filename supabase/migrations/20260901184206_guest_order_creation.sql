create sequence public.order_number_seq start 1000;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'LB-' || nextval('public.order_number_seq')::text;
$$;

-- Por defecto Postgres otorga EXECUTE a PUBLIC en funciones nuevas; se
-- revoca explícitamente para que anon/authenticated no puedan invocarla
-- directo vía RPC y quemar números de secuencia. create_guest_order (más
-- abajo) la sigue pudiendo llamar porque corre como su dueño (security
-- definer), no como el rol que hizo la request.
revoke all on function public.next_order_number from public, anon, authenticated;

create or replace function public.create_guest_order(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_items jsonb -- [{product_id, product_name, sku, unit_cost, unit_price, quantity}]
)
returns table (order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2);
  v_item jsonb;
begin
  insert into customers (first_name, last_name, email, phone)
  values (p_first_name, p_last_name, p_email, p_phone)
  on conflict (email) do update
    set first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone, updated_at = now()
  returning id into v_customer_id;

  select coalesce(sum((item->>'unit_price')::numeric * (item->>'quantity')::int), 0)
  into v_subtotal
  from jsonb_array_elements(p_items) as item;

  v_order_number := public.next_order_number();

  insert into orders (order_number, customer_id, subtotal, total, payment_method)
  values (v_order_number, v_customer_id, v_subtotal, v_subtotal, 'BANK_TRANSFER')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (order_id, product_id, product_name_snapshot, sku_snapshot, unit_cost_snapshot, unit_price, quantity, subtotal)
    values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_item->>'sku',
      (v_item->>'unit_cost')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric * (v_item->>'quantity')::int
    );
  end loop;

  return query select v_order_number;
end;
$$;

revoke all on function public.create_guest_order from public, anon, authenticated;
grant execute on function public.create_guest_order to service_role;
