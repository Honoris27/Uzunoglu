
export const SUPABASE_URL = "https://ykgndzftnniuisdkhjyn.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZ25kemZ0bm5pdWlzZGtoanluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NjMxMjIsImV4cCI6MjA4MDEzOTEyMn0.BiEFebU7clUqfnS0VaroOlbl8wNiQSQc3biDpq-dg7g";

export const SQL_SETUP_SCRIPT = `
-- Drop existing tables to reset schema (Optional, use carefully)
-- drop table if exists public.payment_transactions;
-- drop table if exists public.shares;
-- drop table if exists public.animals;
-- drop table if exists public.app_settings;

-- Create Settings Table with JSONB support for dynamic arrays
create table if not exists public.app_settings (
  id int primary key generated always as identity,
  admin_password text default 'admin123',
  default_image_url text default 'https://images.unsplash.com/photo-1541600383005-565c949cf777?q=80&w=1000&auto=format&fit=crop',
  theme text default 'light',
  animal_types jsonb default '["Büyükbaş", "Küçükbaş"]'::jsonb,
  bank_accounts jsonb default '[]'::jsonb,
  active_announcement text default '',
  announcement_duration_sec int default 60,
  announcement_timestamp text default '',
  notification_sound text default 'ding',
  custom_sound_url text default '',
  site_title text default 'BANA Kurban',
  logo_url text default ''
);

-- Insert default settings if not exists
insert into public.app_settings (admin_password)
select 'admin123'
where not exists (select 1 from public.app_settings);

-- Create Years Table
create table if not exists public.years (
  year int primary key
);

-- Insert current year
insert into public.years (year) values (extract(year from now())) on conflict do nothing;

-- Create animals table (Modified)
create table if not exists public.animals (
  id uuid default gen_random_uuid() primary key,
  tag_number text not null,
  type text not null,
  weight_kg int default 0,
  total_price int not null default 0,
  notes text,
  image_url text,
  year int references public.years(year) on delete cascade,
  max_shares int default 7,
  slaughter_status text default 'SIRADA',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create shares table
create table if not exists public.shares (
  id uuid default gen_random_uuid() primary key,
  animal_id uuid references public.animals(id) on delete cascade,
  name text not null,
  phone text,
  amount_agreed int not null default 0,
  amount_paid int not null default 0,
  status text not null check (status in ('ODENMEDI', 'ODENDI', 'KISMI')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create payment transactions table (NEW)
create table if not exists public.payment_transactions (
  id uuid default gen_random_uuid() primary key,
  share_id uuid references public.shares(id) on delete cascade,
  amount int not null,
  type text not null check (type in ('PAYMENT', 'REFUND', 'SALE_INIT')),
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.animals enable row level security;
alter table public.shares enable row level security;
alter table public.app_settings enable row level security;
alter table public.years enable row level security;
alter table public.payment_transactions enable row level security;

create policy "Public animals access" on public.animals for all using (true);
create policy "Public shares access" on public.shares for all using (true);
create policy "Public settings access" on public.app_settings for all using (true);
create policy "Public years access" on public.years for all using (true);
create policy "Public payments access" on public.payment_transactions for all using (true);
`;
