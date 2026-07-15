-- Run this in Supabase SQL Editor if the public map cannot read initiatives.
-- The browser receives only rows explicitly marked as published.
alter table public.initiatives enable row level security;

create policy "Published initiatives are visible to map visitors"
on public.initiatives
for select
to anon
using (is_published = true);
