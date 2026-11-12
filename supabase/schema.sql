-- Speedy schema. Paste this into the Supabase SQL editor and run it once.
-- It creates empty tables only. It does not insert users, products, clips, or orders.
--
-- After it succeeds:
-- 1. Project Settings → API: copy the project URL and the anon public key.
-- 2. Put them in .env.local as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
-- 3. Authentication → Providers → Email: turn OFF "Confirm email"
--    if new accounts should be able to sign in immediately.

create extension if not exists pgcrypto;

-- Profiles -------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  handle text not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text not null default '' check (char_length(avatar_url) <= 500),
  created_at timestamptz not null default now(),
  unique (handle)
);

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  coins integer not null default 0 check (coins >= 0)
);

create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  delta integer not null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_user_created_idx on public.ledger (user_id, created_at desc);

create table if not exists public.rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('checkin', 'watch', 'share', 'order')),
  claimed_on date not null default (timezone('utc', now()))::date,
  primary key (user_id, kind)
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  line text not null check (char_length(line) between 1 and 160),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Catalog --------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  price numeric(10, 2) not null check (price > 0),
  compare_at numeric(10, 2) check (compare_at is null or compare_at > price),
  stock integer not null check (stock >= 0),
  sold_count integer not null default 0 check (sold_count >= 0),
  category text not null check (category in ('Drops', 'Kicks', 'Beauty', 'Tech', 'Home')),
  flash boolean not null default false,
  sizes text[],
  image_url text not null check (char_length(image_url) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  caption text not null check (char_length(caption) between 1 and 300),
  image_url text not null check (char_length(image_url) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.lives (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  cover_url text not null check (char_length(cover_url) between 1 and 500),
  product_ids uuid[] not null check (cardinality(product_ids) > 0),
  sold_count integer not null default 0 check (sold_count >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.live_viewers (
  live_id uuid not null references public.lives (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (live_id, user_id)
);

create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now()
);

-- Social and shopping --------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  clip_id uuid not null references public.clips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, clip_id)
);

create table if not exists public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  clip_id uuid not null references public.clips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, clip_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  clip_id uuid not null references public.clips (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 180),
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  size text not null default '',
  qty integer not null check (qty > 0 and qty <= 20),
  unique (user_id, product_id, size)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  total numeric(10, 2) not null check (total >= 0),
  bonus integer not null default 0,
  status text not null default 'Placed' check (status in ('Placed', 'Shipped', 'Delivered')),
  address_line text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  product_name text not null,
  buyer_name text not null,
  size text,
  qty integer not null check (qty > 0),
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  view text,
  param text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- New account ----------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_handle text;
  v_requested text;
  v_base text;
  v_n integer := 0;
begin
  v_name := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40);
  if v_name = '' then
    v_name := left(split_part(coalesce(new.email, 'member'), '@', 1), 40);
  end if;

  v_requested := lower(trim(coalesce(new.raw_user_meta_data ->> 'handle', '')));
  v_requested := regexp_replace(v_requested, '[^a-z0-9_]', '', 'g');

  if v_requested <> '' then
    if v_requested !~ '^[a-z0-9_]{3,20}$' then
      raise exception 'Handle must be 3 to 20 letters, numbers, or underscores';
    end if;
    if exists (select 1 from public.profiles where handle = v_requested) then
      raise exception 'That handle is taken';
    end if;
    v_handle := v_requested;
  else
    v_base := regexp_replace(lower(split_part(coalesce(new.email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g');
    if length(v_base) < 3 then
      v_base := 'user';
    end if;
    v_base := left(v_base, 16);
    v_handle := v_base;
    while exists (select 1 from public.profiles where handle = v_handle) loop
      v_n := v_n + 1;
      v_handle := left(v_base, 16) || v_n::text;
      if v_n > 80 then
        raise exception 'That handle is taken';
      end if;
    end loop;
  end if;

  insert into public.profiles (id, display_name, handle, bio)
  values (new.id, v_name, v_handle, '');

  insert into public.wallets (user_id, coins) values (new.id, 0);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_available(p_handle text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where handle = regexp_replace(lower(trim(coalesce(p_handle, ''))), '[^a-z0-9_]', '', 'g')
  );
$$;

-- Keep ownership columns tied to the signed-in user ---------------------------

create or replace function public.force_seller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.seller_id := auth.uid();
  else
    new.seller_id := old.seller_id;
  end if;
  return new;
end;
$$;

create or replace function public.force_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  else
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

create or replace function public.force_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.follower_id := auth.uid();
  return new;
end;
$$;

create or replace function public.force_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.host_id := auth.uid();
  else
    new.host_id := old.host_id;
  end if;
  return new;
end;
$$;

drop trigger if exists products_owner on public.products;
create trigger products_owner before insert or update on public.products
  for each row execute function public.force_seller();

drop trigger if exists clips_owner on public.clips;
create trigger clips_owner before insert or update on public.clips
  for each row execute function public.force_user_id();

drop trigger if exists comments_owner on public.comments;
create trigger comments_owner before insert or update on public.comments
  for each row execute function public.force_user_id();

drop trigger if exists likes_owner on public.likes;
create trigger likes_owner before insert or update on public.likes
  for each row execute function public.force_user_id();

drop trigger if exists saves_owner on public.saves;
create trigger saves_owner before insert or update on public.saves
  for each row execute function public.force_user_id();

drop trigger if exists cart_owner on public.cart_items;
create trigger cart_owner before insert or update on public.cart_items
  for each row execute function public.force_user_id();

drop trigger if exists address_owner on public.addresses;
create trigger address_owner before insert or update on public.addresses
  for each row execute function public.force_user_id();

drop trigger if exists live_messages_owner on public.live_messages;
create trigger live_messages_owner before insert or update on public.live_messages
  for each row execute function public.force_user_id();

drop trigger if exists live_viewers_owner on public.live_viewers;
create trigger live_viewers_owner before insert or update on public.live_viewers
  for each row execute function public.force_user_id();

drop trigger if exists follows_owner on public.follows;
create trigger follows_owner before insert or update on public.follows
  for each row execute function public.force_follower();

drop trigger if exists lives_owner on public.lives;
create trigger lives_owner before insert or update on public.lives
  for each row execute function public.force_host();

create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select display_name into v_name from public.profiles where id = new.follower_id;
  insert into public.notifications (user_id, title, body, view)
  values (new.following_id, 'New follower', coalesce(v_name, 'Someone') || ' followed you', 'profile');
  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_follow();

create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_name text;
begin
  select user_id into v_owner from public.clips where id = new.clip_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  select display_name into v_name from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, title, body, view)
  values (v_owner, 'New comment', coalesce(v_name, 'Someone') || ' commented on your clip', 'feed');
  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

-- Coins and checkout ---------------------------------------------------------

create or replace function public.apply_coin_delta(p_delta integer, p_label text, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coins integer;
  v_id uuid;
  v_today date := (timezone('utc', now()))::date;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;
  if p_kind = 'checkin' and p_delta = 25 then
    if exists (
      select 1 from public.rewards
      where user_id = v_user and kind = 'checkin' and claimed_on = v_today
    ) then
      select coins into v_coins from public.wallets where user_id = v_user;
      return jsonb_build_object('coins', v_coins, 'applied', false);
    end if;
    insert into public.rewards (user_id, kind, claimed_on)
    values (v_user, 'checkin', v_today)
    on conflict (user_id, kind) do update set claimed_on = excluded.claimed_on;
  elsif p_kind = 'watch' and p_delta = 10 then
    insert into public.rewards (user_id, kind) values (v_user, 'watch')
    on conflict do nothing;
    if not found then
      select coins into v_coins from public.wallets where user_id = v_user;
      return jsonb_build_object('coins', v_coins, 'applied', false);
    end if;
  elsif p_kind = 'share' and p_delta = 5 then
    insert into public.rewards (user_id, kind) values (v_user, 'share')
    on conflict do nothing;
    if not found then
      select coins into v_coins from public.wallets where user_id = v_user;
      return jsonb_build_object('coins', v_coins, 'applied', false);
    end if;
  else
    raise exception 'Invalid reward';
  end if;

  update public.wallets
  set coins = coins + p_delta
  where user_id = v_user
  returning coins into v_coins;

  insert into public.ledger (user_id, label, delta)
  values (v_user, left(trim(p_label), 80), p_delta)
  returning id into v_id;

  return jsonb_build_object('coins', v_coins, 'applied', true, 'ledger_id', v_id);
end;
$$;

create or replace function public.send_gift(p_host uuid, p_amount integer, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_coins integer;
  v_host_name text;
  v_sender text;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;
  if p_host is null or p_host = v_user then
    raise exception 'Pick someone else';
  end if;
  if not (
    (p_amount = 10 and p_name = 'Spark')
    or (p_amount = 50 and p_name = 'Bolt')
    or (p_amount = 200 and p_name = 'Storm')
    or (p_amount = 500 and p_name = 'Surge')
    or (p_amount = 1000 and p_name = 'Legend')
  ) then
    raise exception 'Unknown gift';
  end if;

  select display_name into v_host_name from public.profiles where id = p_host;
  if v_host_name is null then
    raise exception 'That host is gone';
  end if;
  select display_name into v_sender from public.profiles where id = v_user;

  update public.wallets
  set coins = coins - p_amount
  where user_id = v_user and coins >= p_amount
  returning coins into v_coins;
  if not found then
    raise exception 'Not enough coins';
  end if;

  update public.wallets set coins = coins + p_amount where user_id = p_host;

  insert into public.ledger (user_id, label, delta)
  values (v_user, left('Gifted ' || p_name || ' to ' || v_host_name, 80), -p_amount);

  insert into public.ledger (user_id, label, delta)
  values (p_host, left(coalesce(v_sender, 'Someone') || ' sent ' || p_name, 80), p_amount);

  insert into public.notifications (user_id, title, body, view)
  values (
    p_host,
    'Gift received',
    coalesce(v_sender, 'Someone') || ' sent you ' || p_name,
    'wallet'
  );

  return jsonb_build_object('coins', v_coins);
end;
$$;

create or replace function public.place_order(p_lines jsonb, p_spent integer, p_address_id uuid, p_live_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  rec record;
  v_product public.products%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_coins integer;
  v_max integer;
  v_total numeric(12, 2);
  v_bonus integer;
  v_order uuid;
  v_items jsonb := '[]'::jsonb;
  v_ledger jsonb := '[]'::jsonb;
  v_address text;
  v_buyer text;
  v_sellers uuid[] := '{}';
  v_live_sold integer := 0;
  v_pinned uuid[];
  v_ledger_id uuid;
  v_at timestamptz := now();
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Your bag is empty';
  end if;
  if jsonb_array_length(p_lines) > 30 then
    raise exception 'Too many items';
  end if;

  select line into v_address
  from public.addresses
  where id = p_address_id and user_id = v_user;
  if v_address is null then
    raise exception 'Add a delivery address';
  end if;

  select display_name into v_buyer from public.profiles where id = v_user;
  select coins into v_coins from public.wallets where user_id = v_user for update;
  if p_live_id is not null then
    select product_ids into v_pinned from public.lives where id = p_live_id and ended_at is null;
  end if;

  for rec in
    select * from jsonb_to_recordset(p_lines) as x(product_id uuid, size text, qty integer)
  loop
    if rec.qty is null or rec.qty < 1 or rec.qty > 20 then
      raise exception 'Bad quantity';
    end if;
    select * into v_product from public.products where id = rec.product_id for update;
    if not found then
      raise exception 'A product in your bag is no longer listed';
    end if;
    if v_product.sizes is not null and cardinality(v_product.sizes) > 0 then
      if rec.size is null or rec.size = '' or not (rec.size = any (v_product.sizes)) then
        raise exception 'Pick a size for %', v_product.name;
      end if;
    end if;
    if v_product.stock < rec.qty then
      raise exception 'Not enough stock for %', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.price * rec.qty);
    update public.products
    set stock = stock - rec.qty, sold_count = sold_count + rec.qty
    where id = v_product.id;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'size', nullif(rec.size, ''),
      'qty', rec.qty,
      'price', v_product.price,
      'name', v_product.name
    ));

    if v_pinned is not null and v_product.id = any (v_pinned) then
      v_live_sold := v_live_sold + rec.qty;
    end if;
    if v_product.seller_id <> v_user and not (v_product.seller_id = any (v_sellers)) then
      v_sellers := v_sellers || v_product.seller_id;
      insert into public.notifications (user_id, title, body, view)
      values (
        v_product.seller_id,
        'New order',
        coalesce(v_buyer, 'Someone') || ' ordered ' || v_product.name,
        'studio'
      );
    end if;
  end loop;

  if p_spent is null then
    p_spent := 0;
  end if;
  v_max := least(v_coins, floor(v_subtotal * 30)::integer);
  if p_spent < 0 or p_spent > v_max then
    raise exception 'Invalid coin amount';
  end if;

  v_total := round(v_subtotal - (p_spent / 100.0), 2);
  v_bonus := case when v_subtotal >= 20 then 15 else 5 end;

  insert into public.orders (user_id, total, bonus, address_line, created_at)
  values (v_user, v_total, v_bonus, v_address, v_at)
  returning id into v_order;

  insert into public.order_items (order_id, product_id, seller_id, product_name, buyer_name, size, qty, price, created_at)
  select
    v_order,
    (item ->> 'productId')::uuid,
    pr.seller_id,
    pr.name,
    coalesce(v_buyer, 'Buyer'),
    nullif(item ->> 'size', ''),
    (item ->> 'qty')::integer,
    pr.price,
    v_at
  from jsonb_array_elements(v_items) item
  join public.products pr on pr.id = (item ->> 'productId')::uuid;

  update public.wallets
  set coins = coins - p_spent + v_bonus
  where user_id = v_user
  returning coins into v_coins;

  if p_spent > 0 then
    insert into public.ledger (user_id, label, delta)
    values (v_user, 'Shop checkout', -p_spent)
    returning id into v_ledger_id;
    v_ledger := v_ledger || jsonb_build_array(jsonb_build_object(
      'id', v_ledger_id, 'label', 'Shop checkout', 'delta', -p_spent, 'at', v_at
    ));
  end if;

  insert into public.ledger (user_id, label, delta)
  values (v_user, 'Order bonus', v_bonus)
  returning id into v_ledger_id;
  v_ledger := v_ledger || jsonb_build_array(jsonb_build_object(
    'id', v_ledger_id, 'label', 'Order bonus', 'delta', v_bonus, 'at', v_at
  ));

  insert into public.rewards (user_id, kind) values (v_user, 'order')
  on conflict do nothing;

  delete from public.cart_items where user_id = v_user;

  if p_live_id is not null and v_live_sold > 0 then
    update public.lives set sold_count = sold_count + v_live_sold where id = p_live_id and ended_at is null;
  end if;

  return jsonb_build_object(
    'coins', v_coins,
    'order', jsonb_build_object(
      'id', v_order,
      'total', v_total,
      'bonus', v_bonus,
      'status', 'Placed',
      'at', v_at,
      'items', v_items
    ),
    'ledger', v_ledger
  );
end;
$$;

create or replace function public.catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.display_name,
        'handle', p.handle,
        'bio', p.bio,
        'avatar', p.avatar_url,
        'followers', (select count(*) from public.follows f where f.following_id = p.id)
      ) order by p.created_at desc)
      from public.profiles p
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'creatorId', pr.seller_id,
        'name', pr.name,
        'price', pr.price,
        'was', pr.compare_at,
        'sold', pr.sold_count,
        'stock', pr.stock,
        'category', pr.category,
        'flash', pr.flash,
        'sizes', case when pr.sizes is null or cardinality(pr.sizes) = 0 then null else to_jsonb(pr.sizes) end,
        'image', pr.image_url,
        'description', pr.description
      ) order by pr.created_at desc)
      from public.products pr
    ), '[]'::jsonb),
    'clips', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'creatorId', c.user_id,
        'productId', c.product_id,
        'caption', c.caption,
        'image', c.image_url,
        'likes', (select count(*) from public.likes l where l.clip_id = c.id),
        'comments', (select count(*) from public.comments m where m.clip_id = c.id),
        'saves', (select count(*) from public.saves s where s.clip_id = c.id)
      ) order by c.created_at desc)
      from public.clips c
    ), '[]'::jsonb),
    'lives', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', lv.id,
        'creatorId', lv.host_id,
        'title', lv.title,
        'cover', lv.cover_url,
        'productIds', to_jsonb(lv.product_ids),
        'sold', lv.sold_count,
        'viewers', (select count(*) from public.live_viewers v where v.live_id = lv.id)
      ) order by lv.started_at desc)
      from public.lives lv
      where lv.ended_at is null
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Access ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger enable row level security;
alter table public.rewards enable row level security;
alter table public.addresses enable row level security;
alter table public.products enable row level security;
alter table public.clips enable row level security;
alter table public.lives enable row level security;
alter table public.live_viewers enable row level security;
alter table public.live_messages enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;

revoke all on public.profiles, public.wallets, public.ledger, public.rewards, public.addresses,
  public.products, public.clips, public.lives, public.live_viewers, public.live_messages,
  public.follows, public.likes, public.saves, public.comments, public.cart_items,
  public.orders, public.order_items, public.notifications
  from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.wallets to authenticated;
grant select on public.ledger to authenticated;
grant select on public.rewards to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, delete on public.clips to authenticated;
grant select, insert, update on public.lives to authenticated;
grant select, insert, delete on public.live_viewers to authenticated;
grant select, insert on public.live_messages to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, insert, delete on public.likes to authenticated;
grant select, insert, delete on public.saves to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists wallets_read on public.wallets;
create policy wallets_read on public.wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists ledger_read on public.ledger;
create policy ledger_read on public.ledger for select to authenticated using (user_id = auth.uid());
drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select to authenticated using (user_id = auth.uid());

drop policy if exists addresses_all on public.addresses;
create policy addresses_all on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists products_read on public.products;
create policy products_read on public.products for select to authenticated using (true);
drop policy if exists products_write on public.products;
create policy products_write on public.products for insert to authenticated with check (seller_id = auth.uid());
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete to authenticated using (seller_id = auth.uid());

drop policy if exists clips_read on public.clips;
create policy clips_read on public.clips for select to authenticated using (true);
drop policy if exists clips_insert on public.clips;
create policy clips_insert on public.clips for insert to authenticated with check (user_id = auth.uid());
drop policy if exists clips_delete on public.clips;
create policy clips_delete on public.clips for delete to authenticated using (user_id = auth.uid());

drop policy if exists lives_read on public.lives;
create policy lives_read on public.lives for select to authenticated using (true);
drop policy if exists lives_insert on public.lives;
create policy lives_insert on public.lives for insert to authenticated with check (host_id = auth.uid());
drop policy if exists lives_update on public.lives;
create policy lives_update on public.lives for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());

drop policy if exists viewers_read on public.live_viewers;
create policy viewers_read on public.live_viewers for select to authenticated using (true);
drop policy if exists viewers_write on public.live_viewers;
create policy viewers_write on public.live_viewers for insert to authenticated with check (user_id = auth.uid());
drop policy if exists viewers_delete on public.live_viewers;
create policy viewers_delete on public.live_viewers for delete to authenticated using (user_id = auth.uid());

drop policy if exists messages_read on public.live_messages;
create policy messages_read on public.live_messages for select to authenticated using (true);
drop policy if exists messages_insert on public.live_messages;
create policy messages_insert on public.live_messages for insert to authenticated with check (user_id = auth.uid());

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to authenticated using (true);
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select to authenticated using (user_id = auth.uid());
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists saves_read on public.saves;
create policy saves_read on public.saves for select to authenticated using (user_id = auth.uid());
drop policy if exists saves_insert on public.saves;
create policy saves_insert on public.saves for insert to authenticated with check (user_id = auth.uid());
drop policy if exists saves_delete on public.saves;
create policy saves_delete on public.saves for delete to authenticated using (user_id = auth.uid());

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated using (user_id = auth.uid());

drop policy if exists cart_all on public.cart_items;
create policy cart_all on public.cart_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated using (user_id = auth.uid());

drop policy if exists items_read on public.order_items;
create policy items_read on public.order_items for select to authenticated
  using (
    seller_id = auth.uid()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists notes_read on public.notifications;
create policy notes_read on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notes_update on public.notifications;
create policy notes_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.force_seller() from public, anon, authenticated;
revoke all on function public.force_user_id() from public, anon, authenticated;
revoke all on function public.force_follower() from public, anon, authenticated;
revoke all on function public.force_host() from public, anon, authenticated;
revoke all on function public.notify_follow() from public, anon, authenticated;
revoke all on function public.notify_comment() from public, anon, authenticated;

revoke all on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to anon, authenticated;

revoke all on function public.apply_coin_delta(integer, text, text) from public;
grant execute on function public.apply_coin_delta(integer, text, text) to authenticated;

revoke all on function public.send_gift(uuid, integer, text) from public;
grant execute on function public.send_gift(uuid, integer, text) to authenticated;

revoke all on function public.place_order(jsonb, integer, uuid, uuid) from public;
grant execute on function public.place_order(jsonb, integer, uuid, uuid) to authenticated;

revoke all on function public.catalog() from public;
grant execute on function public.catalog() to authenticated;

-- Photos uploaded from the app. If Storage is locked, the rest of this script still stands.
do $storage$
begin
  insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

  execute 'drop policy if exists media_read on storage.objects';
  execute 'create policy media_read on storage.objects for select to public using (bucket_id = ''media'')';
  execute 'drop policy if exists media_insert on storage.objects';
  execute 'create policy media_insert on storage.objects for insert to authenticated with check (bucket_id = ''media'' and (storage.foldername(name))[1] = auth.uid()::text)';
  execute 'drop policy if exists media_update on storage.objects';
  execute 'create policy media_update on storage.objects for update to authenticated using (bucket_id = ''media'' and (storage.foldername(name))[1] = auth.uid()::text)';
exception
  when others then
    raise notice 'Storage setup skipped: %', sqlerrm;
end
$storage$;
