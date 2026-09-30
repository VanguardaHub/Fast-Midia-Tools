-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0005: camada analítica (RF-44, RF-54, OKRs seção 3.2)
-- Views com security_invoker: respeitam RLS do usuário que consulta.
-- Power BI conecta ao banco com usuário de leitura (documentado em docs/arquitetura.md).
-- ============================================================

create schema if not exists analytics;
grant usage on schema analytics to authenticated;

-- Job denormalizado
create or replace view analytics.vw_jobs with (security_invoker = true) as
select
  j.id, j.codigo, j.data, j.slot, j.inicio, j.fim, j.status, j.precisa_99, j.prazo_material,
  j.data_edicao, j.bloco_edicao, j.raio_geofence_m, j.ponto_confirmado, j.duracao_real_min,
  j.material_entregue_em, j.cancelado_em, j.criado_em,
  c.id as cliente_id, c.nome as cliente, c.grupo as cliente_grupo,
  f.id as fast_id, f.nome as fast, f.cor as fast_cor,
  p.nome as analista,
  (b.id is not null) as tem_briefing,
  b.preenchido_em as briefing_em,
  (b.preenchido_em is not null and b.preenchido_em < j.inicio) as briefing_antes_da_gravacao,
  ch.capturado_em as checkin_em,
  ch.dentro_geofence as checkin_dentro_geofence,
  ch.precisao_m as checkin_precisao_m,
  sa.capturado_em as checkout_em,
  extract(epoch from (ch.capturado_em - j.inicio)) / 60 as atraso_checkin_min,
  (select count(*) from public.excecao e where e.job_id = j.id) as qtd_excecoes,
  (select count(*) from public.alerta a where a.job_id = j.id and not a.resolvido) as qtd_alertas_abertos
from public.job j
join public.cliente c on c.id = j.cliente_id
join public.fast f on f.id = j.fast_id
left join public.perfil p on p.id = j.analista_id
left join public.briefing b on b.job_id = j.id
left join public.evento_localizacao ch on ch.job_id = j.id and ch.tipo = 'chegada'
left join public.evento_localizacao sa on sa.job_id = j.id and sa.tipo = 'saida';

-- RF-44: gasto de 99 por Fast e por dia
create or replace view analytics.vw_gasto_99 with (security_invoker = true) as
select
  j.data, f.id as fast_id, f.nome as fast, j.id as job_id, j.codigo, c.nome as cliente,
  sum(r.valor) filter (where r.sentido = 'ida') as valor_ida,
  sum(r.valor) filter (where r.sentido = 'volta') as valor_volta,
  coalesce(sum(r.valor), 0) as valor_total,
  bool_and(r.comprovante_path is not null) filter (where r.sentido = 'ida') as comprovante_ida,
  bool_and(r.comprovante_path is not null) filter (where r.sentido = 'volta') as comprovante_volta,
  bool_and(r.validada) as validada,
  bool_or(coalesce(r.divergencia_destino, false)) as divergencia_destino
from public.job j
join public.fast f on f.id = j.fast_id
join public.cliente c on c.id = j.cliente_id
left join public.corrida_99 r on r.job_id = j.id
where j.precisa_99 and j.status <> 'cancelado'
group by j.data, f.id, f.nome, j.id, j.codigo, c.nome;

create or replace view analytics.vw_gasto_99_por_fast_dia with (security_invoker = true) as
select data, fast_id, fast, count(*) as jobs_com_99, sum(valor_total) as gasto_total,
       count(*) filter (where comprovante_ida and comprovante_volta) as jobs_com_comprovantes
from analytics.vw_gasto_99 group by data, fast_id, fast;

-- Indicadores da pesquisa / OKRs (seção 3.2) por período
create or replace function analytics.indicadores_okr(p_inicio date default current_date - 30, p_fim date default current_date)
returns table (indicador text, objetivo text, meta text, valor numeric, numerador bigint, denominador bigint)
language sql stable security invoker set search_path = public, analytics as $$
  with base as (
    select * from analytics.vw_jobs where data between p_inicio and p_fim and status <> 'cancelado'
  ),
  gravados as (select * from base where checkin_em is not null),
  corridas as (select * from analytics.vw_gasto_99 where data between p_inicio and p_fim)
  select 'Agendamentos com conflito ou duplo', 'Conformidade operacional', '0',
         (select count(*) from public.excecao e join public.job j on j.id = e.job_id where e.tipo in ('buffer_2h','agendamento_duplo') and j.data between p_inicio and p_fim)::numeric,
         (select count(*) from public.excecao e join public.job j on j.id = e.job_id where e.tipo in ('buffer_2h','agendamento_duplo') and j.data between p_inicio and p_fim), null
  union all
  select 'Jobs com briefing antes da gravação (%)', 'Conformidade operacional', '100%',
         round(100.0 * count(*) filter (where briefing_antes_da_gravacao) / nullif(count(*), 0), 1),
         count(*) filter (where briefing_antes_da_gravacao), count(*) from gravados
  union all
  select 'Check-in dentro da geofence (%)', 'Comprovação de presença', '≥ 90%',
         round(100.0 * count(*) filter (where checkin_dentro_geofence) / nullif(count(*), 0), 1),
         count(*) filter (where checkin_dentro_geofence), count(*) from gravados
  union all
  select 'Corridas 99 com comprovante e trajeto validados (%)', 'Controle do 99', '≥ 95%',
         round(100.0 * count(*) filter (where comprovante_ida and comprovante_volta and coalesce(validada, false)) / nullif(count(*), 0), 1),
         count(*) filter (where comprovante_ida and comprovante_volta and coalesce(validada, false)), count(*) from corridas
  union all
  select 'Fasts ativos no app (%)', 'Adoção', '≥ 90%',
         round(100.0 * (select count(distinct fast_id) from gravados) / nullif((select count(*) from public.fast where ativo), 0), 1),
         (select count(distinct fast_id) from gravados), (select count(*) from public.fast where ativo)
  union all
  select 'Atraso médio do check-in (min)', 'Eficiência', '—',
         round(avg(atraso_checkin_min)::numeric, 1), null, count(*) from gravados
  union all
  select 'Duração real média da gravação (min)', 'Eficiência', '—',
         round(avg(duracao_real_min)::numeric, 1), null, count(*) filter (where duracao_real_min is not null) from gravados
  union all
  select 'Material entregue em até 24h (%)', 'Conformidade operacional', '—',
         round(100.0 * count(*) filter (where material_entregue_em <= fim + interval '24 hours') / nullif(count(*) filter (where material_entregue_em is not null), 0), 1),
         count(*) filter (where material_entregue_em <= fim + interval '24 hours'), count(*) filter (where material_entregue_em is not null) from gravados
  union all
  select 'Incidentes de privacidade', 'Privacidade', '0', 0, 0, null
$$;

grant select on all tables in schema analytics to authenticated;
grant execute on function analytics.indicadores_okr(date, date) to authenticated;
alter default privileges in schema analytics grant select on tables to authenticated;
