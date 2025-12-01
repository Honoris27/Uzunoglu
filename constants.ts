export const SUPABASE_URL = "https://ykgndzftnniuisdkhjyn.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZ25kemZ0bm5pdWlzZGtoanluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NjMxMjIsImV4cCI6MjA4MDEzOTEyMn0.BiEFebU7clUqfnS0VaroOlbl8wNiQSQc3biDpq-dg7g";

export const SQL_SETUP_SCRIPT = `
-- Create animals table
create table if not exists public.animals (
  id uuid default gen_random_uuid() primary key,
  tag_number text not null,
  type text not null check (type in ('BUYUKBAS', 'KUCUKBAS')),
  weight_kg int not null default 0,
  total_price int not null default 0,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
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

-- Enable RLS but allow public access for this demo (or configure as needed)
alter table public.animals enable row level security;
alter table public.shares enable row level security;

create policy "Public animals access" on public.animals for all using (true);
create policy "Public shares access" on public.shares for all using (true);
`;
