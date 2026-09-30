-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0013: correções P1 da revisão de QA (docs/qa/revisao-usabilidade-2026-09-30.md)
--   #1 alerta resolvido manualmente não é recriado pelo cron enquanto a condição persistir;
--   #2 Fast enxerga quem consultou sua posição (RPC security definer, RNF-04/seção 8);
--   #4 convite: "primeiro acesso" registrado no login pelo link; usado_em preenchido para contas já existentes.
-- ============================================================

-- ---------- #1 alertas periódicos: respeitar resolução manual ----------
create or replace function public.gerar_alertas_periodicos() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_total integer := 0;
  v_parcial integer := 0;
  v_tz text := public.cfg_text('timezone');
  v_hoje date := (now() at time zone v_tz)::date;
  v_atraso interval := make_interval(mins => public.cfg_int('atraso_checkin_alerta_min'));
  v_prazo interval := make_interval(hours => public.cfg_int('prazo_material_horas'));
begin
  -- RF-22: briefing não chegou até D-1
  insert into public.alerta (job_id, tipo, severidade, mensagem)
  select j.id, 'briefing_atrasado', 'atencao', format('Briefing pendente para o job #%s de %s (D-1)', j.codigo, to_char(j.data, 'DD/MM'))
    from public.job j
   where j.status = 'aguardando_briefing' and j.data <= v_hoje + 1
     and not exists (select 1 from public.alerta a where a.job_id = j.id and a.tipo = 'briefing_atrasado' and a.resolvido and a.resolvido_por is not null)
  on conflict (job_id, tipo) where not resolvido do nothing;
  get diagnostics v_parcial = row_count; v_total := v_total + v_parcial;

  -- RF-52: atraso de check-in (uma resolução manual pela supervisora encerra o assunto para aquele job)
  insert into public.alerta (job_id, tipo, severidade, mensagem)
  select j.id, 'checkin_atrasado', 'critico', format('Sem check-in no job #%s, iniciado às %s', j.codigo, to_char(j.inicio at time zone v_tz, 'HH24:MI'))
    from public.job j
   where j.status = 'briefing_recebido' and now() > j.inicio + v_atraso and now() < j.fim + interval '12 hours'
     and not exists (select 1 from public.evento_localizacao e where e.job_id = j.id and e.tipo = 'chegada')
     and not exists (select 1 from public.alerta a where a.job_id = j.id and a.tipo = 'checkin_atrasado' and a.resolvido and a.resolvido_por is not null)
  on conflict (job_id, tipo) where not resolvido do nothing;
  get diagnostics v_parcial = row_count; v_total := v_total + v_parcial;

  -- RF-52 / Processos 1.3: material bruto não entregue em 24h
  insert into public.alerta (job_id, tipo, severidade, mensagem)
  select j.id, 'material_nao_entregue_24h', 'atencao', format('Material bruto do job #%s não entregue em %sh', j.codigo, public.cfg_int('prazo_material_horas'))
    from public.job j
   where j.status = 'em_gravacao' and now() > j.fim + v_prazo
     and not exists (select 1 from public.alerta a where a.job_id = j.id and a.tipo = 'material_nao_entregue_24h' and a.resolvido and a.resolvido_por is not null)
  on conflict (job_id, tipo) where not resolvido do nothing;
  get diagnostics v_parcial = row_count; v_total := v_total + v_parcial;

  -- RF-52 / Processos 3.2: comprovante de 99 faltando
  insert into public.alerta (job_id, tipo, severidade, mensagem)
  select j.id, 'comprovante_faltando', 'atencao', format('Job #%s precisa de 99 e ainda não tem os dois comprovantes', j.codigo)
    from public.job j
   where j.precisa_99 and j.status in ('material_entregue', 'em_edicao') and j.data < v_hoje
     and (not exists (select 1 from public.corrida_99 c where c.job_id = j.id and c.sentido = 'ida' and c.comprovante_path is not null)
       or not exists (select 1 from public.corrida_99 c where c.job_id = j.id and c.sentido = 'volta' and c.comprovante_path is not null))
     and not exists (select 1 from public.alerta a where a.job_id = j.id and a.tipo = 'comprovante_faltando' and a.resolvido and a.resolvido_por is not null)
  on conflict (job_id, tipo) where not resolvido do nothing;
  get diagnostics v_parcial = row_count; v_total := v_total + v_parcial;
  return v_total;
end $$;

-- Ao reabrir um alerta resolvido manualmente, ele volta a ser "do sistema" e o cron pode voltar a acompanhá-lo
-- (reabrirAlerta zera resolvido_por; nada a fazer aqui).

-- ---------- #2 transparência: Fast vê quem consultou sua posição ----------
create or replace function public.minhas_consultas_posicao(p_limite integer default 50)
returns table (criado_em timestamptz, usuario_email text, entidade text, referencia text)
language sql stable security definer set search_path = public as $$
  with meu as (select f.id as fast_id from public.fast f where f.perfil_id = auth.uid())
  select a.criado_em, a.usuario_email, a.entidade,
         case when a.entidade = 'job' then '#' || (select j.codigo::text from public.job j where j.id::text = a.entidade_id)
              else 'mapa do dia ' || to_char(a.entidade_id::date, 'DD/MM') end
    from public.auditoria a, meu
   where a.acao = 'consulta_posicao'
     and (
       (a.entidade = 'job' and a.dados ->> 'fast_id' = meu.fast_id::text)
       or (a.entidade = 'mapa_do_dia' and exists (select 1 from public.job j where j.fast_id = meu.fast_id and j.data = a.entidade_id::date and j.status <> 'cancelado'))
     )
   order by a.criado_em desc
   limit greatest(1, least(p_limite, 200));
$$;
revoke all on function public.minhas_consultas_posicao(integer) from public;
grant execute on function public.minhas_consultas_posicao(integer) to authenticated;

-- ---------- #4 convites: primeiro acesso e contas já existentes ----------
alter table public.convite add column if not exists primeiro_acesso_em timestamptz;
comment on column public.convite.usado_em is 'Conta criada (auth.users) para o e-mail convidado';
comment on column public.convite.primeiro_acesso_em is 'Primeiro login pelo link de convite/acesso (auth/confirmar)';

update public.convite c
   set usado_em = coalesce(c.usado_em, p.criado_em)
  from public.perfil p
 where lower(p.email) = lower(c.email) and c.usado_em is null;

create or replace function public.registrar_primeiro_acesso() returns void
language sql security definer set search_path = public as $$
  update public.convite
     set primeiro_acesso_em = coalesce(primeiro_acesso_em, now()),
         usado_em = coalesce(usado_em, now())
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
revoke all on function public.registrar_primeiro_acesso() from public;
grant execute on function public.registrar_primeiro_acesso() to authenticated;
