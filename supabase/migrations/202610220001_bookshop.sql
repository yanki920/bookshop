-- Run once in the Supabase SQL editor. No passwords or API keys belong here.
create table if not exists public.shop_clock (singleton boolean primary key default true check (singleton), revision bigint not null default 0);
insert into public.shop_clock(singleton,revision) values(true,0) on conflict do nothing;
create table if not exists public.shop_documents (
 collection text not null check (collection in ('meta','orders','invoices','allocations','team','suppliers','profiles','sessions','attempts','files')),
 id text not null, document jsonb not null, revision bigint not null, primary key(collection,id)
);
create index if not exists shop_documents_changes on public.shop_documents(collection,revision);
alter table public.shop_clock enable row level security;
alter table public.shop_documents enable row level security;
revoke all on public.shop_clock,public.shop_documents from public,anon,authenticated;
grant all on public.shop_clock,public.shop_documents to service_role;

create or replace function public.shop_snapshot(p_collections text[],p_ids jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',c.revision,'rows',coalesce((select jsonb_agg(jsonb_build_object('collection',d.collection,'id',d.id,'document',d.document)) from public.shop_documents d where d.collection=any(p_collections) and (not (p_ids ? d.collection) or (p_ids->d.collection) ? d.id)),'[]'::jsonb)) from public.shop_clock c where singleton;
$$;
create or replace function public.shop_commit(p_revision bigint,p_puts jsonb,p_deletes jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
 declare current_revision bigint; next_revision bigint; item jsonb;
 begin
 select revision into current_revision from public.shop_clock where singleton for update;
 if current_revision<>p_revision then raise exception 'SHOP_CONFLICT' using errcode='PT409'; end if;
 next_revision:=current_revision+1;
 for item in select * from jsonb_array_elements(p_puts) loop
 insert into public.shop_documents(collection,id,document,revision) values(item->>'collection',item->>'id',item->'document',next_revision)
 on conflict(collection,id) do update set document=excluded.document,revision=excluded.revision;
 end loop;
 for item in select * from jsonb_array_elements(p_deletes) loop
 delete from public.shop_documents where collection=item->>'collection' and id=item->>'id';
 end loop;
 update public.shop_clock set revision=next_revision where singleton;
 return next_revision;
 end;
$$;
create or replace function public.shop_changes(p_after bigint default -1)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('revision',c.revision,
 'orders',coalesce((select jsonb_agg(document) from public.shop_documents where collection='orders' and revision>p_after),'[]'::jsonb),
 'suppliers',coalesce((select jsonb_agg(document) from public.shop_documents where collection='suppliers' and revision>p_after),'[]'::jsonb),
 'workersChanged',exists(select 1 from public.shop_documents where collection='team' and revision>p_after),
 'workers',coalesce((select document->'workers' from public.shop_documents where collection='team' and id='workspace' and revision>p_after),'[]'::jsonb)) from public.shop_clock c where singleton;
$$;
revoke all on function public.shop_snapshot(text[],jsonb),public.shop_commit(bigint,jsonb,jsonb),public.shop_changes(bigint) from public,anon,authenticated;
grant execute on function public.shop_snapshot(text[],jsonb),public.shop_commit(bigint,jsonb,jsonb),public.shop_changes(bigint) to service_role;
-- Browser clients have no direct database access. Netlify keeps the service key private.
-- File objects are private; the API checks shop/team permissions before serving them.
do $$ begin
 if to_regclass('storage.buckets') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('bookshop-files','bookshop-files',false,4000000,array['application/pdf','image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
 end if;
end $$;
