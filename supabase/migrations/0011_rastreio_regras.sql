-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0011: rastreio na janela do job (RF-38) — parte 2/2
-- Regras para o tipo 'posicao':
--   * só entre chegada e saída do job, na janela e com consentimento do termo vigente (validação já existente);
--   * só com rastreio_habilitado = true;
--   * limitação de frequência no banco (rastreio_intervalo_s): posições mais frequentes são descartadas silenciosamente;
--   * não geram alerta, exceção nem espelho no Notion; retenção própria (retencao_rastreio_dias).
-- Auditoria do mapa do dia agrupada por janela (auditoria_mapa_janela_min) — o mapa agora recarrega a cada posição.
-- ============================================================

create or replace function public.tg_evento_localizacao_validar() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_job public.job%rowtype;
  v_fast public.fast%rowtype;
  v_precisao_max numeric := public.cfg_int('precisao_maxima_m');
  v_antes interval := make_interval(mins => public.cfg_int('janela_checkin_antes_min'));
  v_depois interval := make_interval(mins => public.cfg_int('janela_checkin_depois_min'));
  v_versao text := public.cfg_text('versao_termo_vigente');
  v_intervalo interval := make_interval(secs => coalesce(public.cfg_int('rastreio_intervalo_s'), 30));
begin
  select * into v_job from public.job where id = new.job_id;
  if v_job.id is null then raise exception 'JOB_INEXISTENTE'; end if;
  if v_job.status = 'cancelado' then raise exception 'JOB_CANCELADO'; end if;

  select * into v_fast from public.fast where id = new.fast_id;
  if v_fast.id is null or v_fast.id <> v_job.fast_id then
    raise exception 'FAST_DIVERGENTE: o evento deve ser do Fast responsável pelo job' using errcode = '42501';
  end if;

  -- Seção 8 / RNF-04: consentimento vigente obrigatório antes de qualquer captura
  if v_fast.perfil_id is not null and not exists (
    select 1 from public.consentimento c where c.usuario_id = v_fast.perfil_id and c.versao_termo = v_versao
  ) then
    raise exception 'CONSENTIMENTO_PENDENTE: aceite o termo de ciência versão % antes do check-in', v_versao using errcode = 'P0005';
  end if;

  -- RF-35: captura apenas dentro da janela do job
  if new.capturado_em < v_job.inicio - v_antes or new.capturado_em > v_job.fim + v_depois then
    raise exception 'FORA_DA_JANELA: captura permitida entre % e %', v_job.inicio - v_antes, v_job.fim + v_depois using errcode = 'P0006';
  end if;

  if new.tipo = 'chegada' then
    -- RF-21: nenhum check-in sem briefing
    if not exists (select 1 from public.briefing b where b.job_id = new.job_id) then
      raise exception 'SEM_BRIEFING: o job não possui briefing preenchido' using errcode = 'P0007';
    end if;
    if v_job.status not in ('briefing_recebido') then
      raise exception 'STATUS_INVALIDO_PARA_CHECKIN: status atual %', v_job.status using errcode = 'P0008';
    end if;
  elsif new.tipo = 'saida' then
    if not exists (select 1 from public.evento_localizacao e where e.job_id = new.job_id and e.tipo = 'chegada') then
      raise exception 'SEM_CHECKIN: registre a chegada antes da saída' using errcode = 'P0009';
    end if;
  elsif new.tipo = 'posicao' then
    -- RF-38 / ADR-0005: posição periódica só entre chegada e saída, com o recurso habilitado
    if coalesce(public.cfg_text('rastreio_habilitado'), 'false') <> 'true' then
      raise exception 'RASTREIO_DESABILITADO: compartilhamento de posição desligado pela administração' using errcode = 'P0012';
    end if;
    if not exists (select 1 from public.evento_localizacao e where e.job_id = new.job_id and e.tipo = 'chegada')
       or exists (select 1 from public.evento_localizacao e where e.job_id = new.job_id and e.tipo = 'saida') then
      raise exception 'RASTREIO_FORA_DA_GRAVACAO: posição só é aceita entre a chegada e a saída' using errcode = 'P0013';
    end if;
    -- limitação de frequência: descarta silenciosamente (o app tenta a cada intervalo; o banco é a autoridade)
    if exists (
      select 1 from public.evento_localizacao e
       where e.job_id = new.job_id and e.tipo = 'posicao' and e.capturado_em > new.capturado_em - v_intervalo
    ) then
      return null;
    end if;
    new.justificativa := null;
  end if;

  -- RF-31/RF-33: comparação com a geofence do job
  if v_job.ponto is not null then
    new.distancia_m := round(st_distance(v_job.ponto, new.ponto)::numeric, 1);
    new.dentro_geofence := new.distancia_m <= v_job.raio_geofence_m;
  else
    new.distancia_m := null;
    new.dentro_geofence := null;
  end if;

  -- RF-34 / RNF-06: fora da geofence ou baixa precisão exigem justificativa
  if new.tipo in ('chegada', 'saida') then
    if new.precisao_m > v_precisao_max and coalesce(new.justificativa, '') = '' then
      raise exception 'BAIXA_PRECISAO_SEM_JUSTIFICATIVA: precisão % m acima do limite de % m', new.precisao_m, v_precisao_max using errcode = 'P0010';
    end if;
    if coalesce(new.dentro_geofence, false) = false and coalesce(new.justificativa, '') = '' then
      raise exception 'FORA_GEOFENCE_SEM_JUSTIFICATIVA: distância % m, raio % m', coalesce(new.distancia_m::text, 'desconhecida'), v_job.raio_geofence_m using errcode = 'P0011';
    end if;
  end if;
  return new;
end $$;

-- Pós-inserção: posições periódicas não geram alerta/exceção nem espelho no Notion
create or replace function public.tg_evento_localizacao_pos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_chegada timestamptz;
  v_precisao_max numeric := public.cfg_int('precisao_maxima_m');
begin
  if new.tipo = 'posicao' then
    return new;
  end if;
  if new.tipo = 'chegada' then
    update public.job set status = 'em_gravacao' where id = new.job_id and status = 'briefing_recebido';
    update public.alerta set resolvido = true, resolvido_em = now() where job_id = new.job_id and tipo = 'checkin_atrasado' and not resolvido;
  elsif new.tipo = 'saida' then
    select capturado_em into v_chegada from public.evento_localizacao where job_id = new.job_id and tipo = 'chegada';
    update public.job set duracao_real_min = greatest(0, extract(epoch from (new.capturado_em - v_chegada)) / 60)::int where id = new.job_id;
  end if;

  if new.tipo in ('chegada', 'saida') then
    if coalesce(new.dentro_geofence, false) = false then
      insert into public.alerta (job_id, tipo, severidade, mensagem)
      values (new.job_id, 'checkin_fora_geofence', 'critico',
              format('%s fora da geofence (%s m; raio %s m). Justificativa: %s', initcap(new.tipo::text), coalesce(new.distancia_m::text, '?'),
                     (select raio_geofence_m from public.job where id = new.job_id), new.justificativa))
      on conflict (job_id, tipo) where not resolvido do nothing;
      insert into public.excecao (job_id, tipo, motivo, solicitada_por)
      values (new.job_id, 'checkin_fora_geofence', new.justificativa, auth.uid());
    end if;
    if new.precisao_m > v_precisao_max then
      insert into public.alerta (job_id, tipo, severidade, mensagem)
      values (new.job_id, 'checkin_baixa_precisao', 'atencao',
              format('%s com precisão de %s m (limite %s m). Justificativa: %s', initcap(new.tipo::text), new.precisao_m, v_precisao_max, new.justificativa))
      on conflict (job_id, tipo) where not resolvido do nothing;
      insert into public.excecao (job_id, tipo, motivo, solicitada_por)
      values (new.job_id, 'checkin_baixa_precisao', new.justificativa, auth.uid());
    end if;
  end if;
  perform public.enfileirar_integracao('notion_upsert', 'notion:job:' || new.job_id, jsonb_build_object('job_id', new.job_id));
  return new;
end $$;

-- Mapa do dia: auditoria agrupada por janela (o mapa recarrega a cada posição recebida)
create or replace function public.mapa_do_dia(p_data date default current_date)
returns table (
  fast_id uuid, fast_nome text, cor text, job_id uuid, codigo bigint, cliente text, status public.job_status,
  tipo public.evento_localizacao_tipo, lat double precision, lng double precision, precisao_m numeric,
  capturado_em timestamptz, dentro_geofence boolean, job_lat double precision, job_lng double precision, raio_geofence_m integer
)
language plpgsql security definer set search_path = public, extensions as $$
declare v_janela interval := make_interval(mins => coalesce(public.cfg_int('auditoria_mapa_janela_min'), 10));
begin
  if not public.eh_gestao() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.auditoria a
     where a.usuario_id = auth.uid() and a.acao = 'consulta_posicao' and a.entidade = 'mapa_do_dia'
       and a.entidade_id = p_data::text and a.criado_em > now() - v_janela
  ) then
    insert into public.auditoria (usuario_id, usuario_email, acao, entidade, entidade_id, dados)
    values (auth.uid(), auth.jwt() ->> 'email', 'consulta_posicao', 'mapa_do_dia', p_data::text,
            jsonb_build_object('data', p_data, 'janela_min', extract(epoch from v_janela) / 60));
  end if;

  return query
  with ultimo as (
    select distinct on (e.fast_id) e.*
      from public.evento_localizacao e
      join public.job j on j.id = e.job_id
     where j.data = p_data
     order by e.fast_id, e.capturado_em desc
  )
  select f.id, f.nome, f.cor, j.id, j.codigo, c.nome, j.status,
         u.tipo, st_y(u.ponto::geometry), st_x(u.ponto::geometry), u.precisao_m, u.capturado_em, u.dentro_geofence,
         st_y(j.ponto::geometry), st_x(j.ponto::geometry), j.raio_geofence_m
    from public.job j
    join public.fast f on f.id = j.fast_id
    join public.cliente c on c.id = j.cliente_id
    left join ultimo u on u.job_id = j.id
   where j.data = p_data and j.status <> 'cancelado'
   order by f.nome, j.inicio;
end $$;

-- Expurgo: posições de rastreio têm retenção própria, menor
create or replace function public.expurgar_eventos_localizacao() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_dias integer := public.cfg_int('retencao_localizacao_dias');
  v_dias_rastreio integer := coalesce(public.cfg_int('retencao_rastreio_dias'), 7);
  v_qtd integer; v_qtd_rastreio integer;
begin
  delete from public.evento_localizacao where tipo = 'posicao' and capturado_em < now() - make_interval(days => v_dias_rastreio);
  get diagnostics v_qtd_rastreio = row_count;
  delete from public.evento_localizacao where capturado_em < now() - make_interval(days => v_dias);
  get diagnostics v_qtd = row_count;
  insert into public.auditoria (acao, entidade, dados)
  values ('expurgo_retencao', 'evento_localizacao',
          jsonb_build_object('dias', v_dias, 'excluidos', v_qtd, 'dias_rastreio', v_dias_rastreio, 'excluidos_rastreio', v_qtd_rastreio));
  return v_qtd + v_qtd_rastreio;
end $$;
