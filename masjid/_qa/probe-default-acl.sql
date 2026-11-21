-- Diagnosa 2: default privileges GLOBAL vs per-schema
begin;
create temp table qa_probe_res(tag text, res jsonb) on commit drop;

create schema if not exists qa_scratch_c;

-- global default privileges (tanpa IN SCHEMA)
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres grant execute on functions to authenticated, service_role;

create function qa_scratch_c.f_global() returns int language sql as $$ select 1 $$;

insert into qa_probe_res
select 'global_entry', jsonb_build_object('acl', p.proacl::text,
         'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
         'auth', has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  from pg_proc p where p.proname = 'f_global';

insert into qa_probe_res
select 'default_acl_global', jsonb_build_object('ns', d.defaclnamespace::text, 'acl', d.defaclacl::text)
  from pg_default_acl d
 where d.defaclrole = 'postgres'::regrole and d.defaclobjtype = 'f';

-- sekarangoba hapus entri per-schema public: revoke semua role dari default
alter default privileges for role postgres in schema public revoke execute on functions from postgres, anon, authenticated, service_role;

insert into qa_probe_res
select 'acl_setelah_kosongkan', jsonb_build_object('acl', d.defaclacl::text)
  from pg_default_acl d
 where d.defaclrole = 'postgres'::regrole
   and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f';

create function public.qa_probe8() returns int language sql as $$ select 1 $$;
insert into qa_probe_res
select 'public_tanpa_entry', jsonb_build_object('acl', p.proacl::text,
         'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
         'auth', has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  from pg_proc p where p.proname = 'qa_probe8';

select * from qa_probe_res order by tag;
rollback;
