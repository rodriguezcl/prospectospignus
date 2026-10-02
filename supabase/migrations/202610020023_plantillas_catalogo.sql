begin;

-- Los IDs de tipos se conservan; las nuevas plantillas agregan alcance y composición.
alter function privado.validar_catalogo_020(jsonb) rename to validar_catalogo_base_023;
create function privado.validar_catalogo_020(d jsonb) returns void
language plpgsql set search_path='' as $$
declare t jsonb; c jsonb; p jsonb; m jsonb; i jsonb; auxiliares jsonb := '[]';
begin
 if jsonb_typeof(d->'tipos') is distinct from 'array' then raise exception 'CATALOGO_DATOS'; end if;
 for t in select * from jsonb_array_elements(d->'tipos') loop
  if char_length(trim(coalesce(t->>'nombre',''))) not between 2 and 100 then raise exception 'CATALOGO_PLANTILLA'; end if;
  auxiliares := auxiliares || jsonb_build_array(jsonb_set(t,'{nombre}',t->'id'));
  -- Tipos anteriores se conservan para sus ofertas, sin inferir una composición.
  if not (t ? 'marca_id') then continue; end if;
  select x into m from jsonb_array_elements(d->'marcas') x where x->>'id'=t->>'marca_id';
  if m is null or coalesce(t->>'servicio','') not in ('alarma','camaras')
   or char_length(trim(coalesce(t->>'variante',''))) not between 2 and 100
   or jsonb_typeof(t->'incluidos') is distinct from 'array'
   then raise exception 'CATALOGO_PLANTILLA'; end if;
  if t->>'estado'='activo' and (m->>'estado'<>'activo' or jsonb_array_length(t->'incluidos')=0)
   then raise exception 'CATALOGO_PLANTILLA'; end if;
  if exists(select 1 from jsonb_array_elements(t->'incluidos') x group by x->>'item_id' having count(*)>1)
   then raise exception 'CATALOGO_DUPLICADO'; end if;
  for c in select * from jsonb_array_elements(t->'incluidos') loop
   select x into p from jsonb_array_elements(d->'items') x where x->>'id'=c->>'item_id';
   if p is null or p->>'tipo'<>'adicional' or p->>'marca_id' is distinct from t->>'marca_id'
    or p->>'servicio' is distinct from t->>'servicio'
    or jsonb_typeof(c->'cantidad') is distinct from 'number'
    or coalesce(c->>'cantidad','') !~ '^[1-9][0-9]{0,3}$'
    or (t->>'estado'='activo' and p->>'estado'<>'activo') then raise exception 'CATALOGO_PLANTILLA'; end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'tipos') x
  group by x->>'marca_id',x->>'servicio',upper(trim(x->>'variante')),upper(trim(x->>'nombre')) having count(*)>1)
  then raise exception 'CATALOGO_DUPLICADO'; end if;
 perform privado.validar_catalogo_base_023(jsonb_set(d,'{tipos}',auxiliares));
 for i in select * from jsonb_array_elements(d->'items') where value->>'tipo'='kit' loop
  select x into t from jsonb_array_elements(d->'tipos') x where x->>'id'=i->>'tipo_comercial_id';
  if t ? 'marca_id' and (t->>'marca_id' is distinct from i->>'marca_id' or t->>'servicio' is distinct from i->>'servicio')
   then raise exception 'CATALOGO_PLANTILLA'; end if;
 end loop;
end $$;
revoke all on function privado.validar_catalogo_020(jsonb),privado.validar_catalogo_base_023(jsonb) from public,anon,authenticated;

alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_023;
revoke all on function public.guardar_catalogo_base_023(integer,uuid,jsonb) from public,anon,authenticated;
create function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare anterior jsonb; t jsonb; n jsonb; lista jsonb := '[]';
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 -- Reintentos de versiones publicadas siguen siendo idempotentes.
 if exists(select 1 from public.versiones_catalogo where operacion=p_operacion and actor_id=auth.uid() and datos=privado.normalizar_catalogo_021(p_datos) and version_anterior=p_version) then
  return public.guardar_catalogo_base_023(p_version,p_operacion,p_datos);
 end if;
 select datos into anterior from public.versiones_catalogo order by version desc limit 1;
 if anterior->'plantillas_version'='1'::jsonb and p_datos->'plantillas_version' is distinct from '1'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 for t in select * from jsonb_array_elements(coalesce(anterior->'tipos','[]')) loop
  select x into n from jsonb_array_elements(coalesce(p_datos->'tipos','[]')) x where x->>'id'=t->>'id';
  if t ? 'marca_id' and n is not null and not (n ? 'marca_id') then raise exception 'CATALOGO_PLANTILLA'; end if;
 end loop;
 for t in select * from jsonb_array_elements(coalesce(p_datos->'tipos','[]')) loop
  if t ? 'variante' then t := jsonb_set(t,'{variante}',to_jsonb(upper(trim(t->>'variante')))); end if;
  lista := lista || jsonb_build_array(t);
 end loop;
 if p_datos ? 'tipos' then p_datos := jsonb_set(p_datos,'{tipos}',lista); end if;
 return public.guardar_catalogo_base_023(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo(integer,uuid,jsonb) to authenticated;
create function public.guardar_catalogo_023(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if p_datos->'plantillas_version' is distinct from '1'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo_023(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo_023(integer,uuid,jsonb) to authenticated;
commit;
