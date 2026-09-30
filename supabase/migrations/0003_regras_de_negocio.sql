-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0003: regras de negócio aplicadas por sistema
-- RF-12, RF-13, RF-14, RF-21, RF-31..RF-36, RF-42, RF-43, RNF-06, RNF-08, RNF-12
-- ============================================================

-- ---------- Helpers de identidade ----------
create or replace function public.auth_perfil() returns public.perfil_tipo
language sql stable security definer set search_path = public as $$
  select perfil from public.perfil where id = auth.uid() and ativo
$$;

create or replace function public.auth_fast_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.fast where perfil_id = auth.uid() and ativo
$$;

create or replace function public.eh_gestao() returns boolean
language sql stable as $$
  select coalesce(public.auth_perfil() in ('supervisora', 'admin'), false)
$$;

create or replace function public.eh_admin() returns boolean
language sql stable as $$
  select coalesce(public.auth_perfil() = 'admin', false)
$$;

-- service_role (worker/cron) não tem auth.uid(); tratado como sistema
create or replace function public.eh_sistema() returns boolean
language sql stable as $$
  select auth.uid() is null and coalesce(auth.role(), '') not in ('anon', 'authenticated')
$$;

-- ---------- Auditoria genérica (RNF-12) ----------
create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dados jsonb;
  v_id text;
  k text;
begin
  if tg_op = 'INSERT' then
    v_dados := to_jsonb(new);
    v_id := (to_jsonb(new) ->> 'id');
  elsif tg_op = 'UPDATE' then
    v_dados := '{}'::jsonb;
    for k in select key from jsonb_each(to_jsonb(new)) loop
      if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
        v_dados := v_dados || jsonb_build_object(k, jsonb_build_object('de', to_jsonb(old) -> k, 'para', to_jsonb(new) -> k));
      end if;
    end loop;
    v_id := (to_jsonb(new) ->> 'id');
    if v_dados = '{}'::jsonb then return new; end if;
  else
    v_dados := to_jsonb(old);
    v_id := (to_jsonb(old) ->> 'id');
  end if;

  -- Nunca registrar geometria bruta nem arquivos no log de auditoria
  v_dados := v_dados - 'ponto' - 'destino_ponto';

  insert into public.auditoria (usuario_id, usuario_email, acao, entidade, entidade_id, dados)
  values (auth.uid(), auth.jwt() ->> 'email', lower(tg_op), tg_table_name, v_id, v_dados);
  return coalesce(new, old);
end $$;

create trigger job_auditoria after insert or update or delete on public.job
  for each row execute function public.auditar();
create trigger briefing_auditoria after insert or update or delete on public.briefing
  for each row execute function public.auditar();
create trigger excecao_auditoria after insert or update or delete on public.excecao
  for each row execute function public.auditar();
create trigger corrida_99_auditoria after insert or update or delete on public.corrida_99
  for each row execute function public.auditar();
create trigger fast_auditoria after insert or update or delete on public.fast
  for each row execute function public.auditar();
create trigger cliente_auditoria after insert or update or delete on public.cliente
  for each row execute function public.auditar();
create trigger perfil_auditoria after insert or update or delete on public.perfil
  for each row execute function public.auditar();
create trigger configuracao_auditoria after insert or update or delete on public.configuracao
  for each row execute function public.auditar();

-- ---------- Outbox ----------
create or replace function public.enfileirar_integracao(
  p_tipo public.integracao_tipo, p_chave text, p_payload jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.fila_integracao (tipo, chave_idempotencia, payload)
  values (p_tipo, p_chave, p_payload)
  on conflict (chave_idempotencia) do update
    set payload = excluded.payload,
        status = case when public.fila_integracao.status = 'ok' then 'pendente'::public.integracao_status else public.fila_integracao.status end,
        proximo_em = now();
end $$;

-- ---------- Identidade: criação de perfil e domínio corporativo (RF-01) ----------
create or replace function public.tg_auth_usuario_validar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dominio text := lower(split_part(new.email, '@', 2));
  v_permitido boolean;
begin
  select exists (
    select 1 from jsonb_array_elements_text(public.cfg_json('dominios_email_permitidos')) d where lower(d) = v_dominio
  ) or exists (select 1 from public.convite where lower(email) = lower(new.email))
    or exists (select 1 from public.fast where lower(email_calendario) = lower(new.email))
  into v_permitido;

  if not coalesce(v_permitido, false) then
    raise exception 'EMAIL_NAO_AUTORIZADO: % não pertence ao domínio corporativo nem possui convite', new.email
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger auth_usuario_validar before insert on auth.users
  for each row execute function public.tg_auth_usuario_validar();

create or replace function public.tg_auth_usuario_criado() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_convite public.convite%rowtype;
  v_perfil public.perfil_tipo := 'fast';
  v_nome text := coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));
begin
  select * into v_convite from public.convite where lower(email) = lower(new.email);
  if found then
    v_perfil := v_convite.perfil;
    v_nome := coalesce(v_convite.nome, v_nome);
    update public.convite set usado_em = now() where email = v_convite.email;
  end if;

  -- Primeiro usuário do sistema vira admin (bootstrap); demais seguem convite/padrão
  if not exists (select 1 from public.perfil) then
    v_perfil := 'admin';
  end if;

  insert into public.perfil (id, nome, email, perfil) values (new.id, v_nome, new.email, v_perfil);

  -- Vincula automaticamente ao cadastro de Fast pelo e-mail do calendário
  update public.fast set perfil_id = new.id
   where lower(email_calendario) = lower(new.email) and perfil_id is null;
  return new;
end $$;

create trigger auth_usuario_criado after insert on auth.users
  for each row execute function public.tg_auth_usuario_criado();

-- Somente admin altera o campo perfil (RLS permite auto-edição de nome/telefone)
create or replace function public.tg_perfil_proteger() returns trigger
language plpgsql as $$
begin
  if (new.perfil is distinct from old.perfil or new.ativo is distinct from old.ativo)
     and not public.eh_admin() and not public.eh_sistema() then
    raise exception 'SEM_PERMISSAO: apenas Admin altera perfil ou status de acesso' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger perfil_proteger before update on public.perfil
  for each row execute function public.tg_perfil_proteger();

-- ---------- Job: intervalo, buffer 2h, agendamento duplo (RF-12, RF-13) ----------
create or replace function public.job_intervalo(p_data date, p_slot public.slot_tipo)
returns tstzrange language plpgsql stable as $$
declare
  v_slot jsonb := public.cfg_json('slots') -> p_slot::text;
  v_tz text := public.cfg_text('timezone');
begin
  if v_slot is null then raise exception 'SLOT_INVALIDO: %', p_slot; end if;
  return tstzrange(
    (p_data + make_interval(hours => (v_slot ->> 'inicio')::int)) at time zone v_tz,
    (p_data + make_interval(hours => (v_slot ->> 'fim')::int)) at time zone v_tz,
    '[)'
  );
end $$;

create or replace function public.tg_job_validar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_int tstzrange;
  v_buffer interval := make_interval(mins => public.cfg_int('buffer_minimo_minutos'));
  v_conflito_buffer public.job%rowtype;
  v_conflito_duplo public.job%rowtype;
  v_pode_aprovar boolean := public.eh_gestao() or public.eh_sistema();
  v_precisa_excecao boolean := false;
  v_ida int; v_volta int;
begin
  -- Intervalo derivado do slot (fonte única: configuração)
  v_int := public.job_intervalo(new.data, new.slot);
  new.inicio := lower(v_int);
  new.fim := upper(v_int);
  if new.raio_geofence_m is null then new.raio_geofence_m := public.cfg_int('raio_geofence_padrao_m'); end if;

  if new.status = 'cancelado' then
    if new.cancelado_em is null then new.cancelado_em := now(); end if;
    return new;
  end if;

  -- Só valida agenda quando data/slot/fast mudam ou no insert
  if tg_op = 'INSERT' or new.data <> old.data or new.slot <> old.slot or new.fast_id <> old.fast_id or old.status = 'cancelado' then
    -- RF-13: agendamento duplo no mesmo dia
    select * into v_conflito_duplo from public.job j
     where j.fast_id = new.fast_id and j.data = new.data and j.status <> 'cancelado' and j.id <> new.id limit 1;

    -- RF-12: folga mínima de 2h entre jobs do mesmo Fast (qualquer dia)
    select * into v_conflito_buffer from public.job j
     where j.fast_id = new.fast_id and j.status <> 'cancelado' and j.id <> new.id
       and tstzrange(j.inicio - v_buffer, j.fim + v_buffer, '()') && v_int
     limit 1;

    if v_conflito_duplo.id is not null or v_conflito_buffer.id is not null then
      v_precisa_excecao := true;
      if not (v_pode_aprovar and coalesce(new.excecao_motivo, '') <> '') then
        if v_conflito_duplo.id is not null then
          raise exception 'AGENDAMENTO_DUPLO: o Fast já tem job em % (job #%). Requer aprovação da supervisora com motivo.', new.data, v_conflito_duplo.codigo
            using errcode = 'P0002';
        end if;
        raise exception 'BUFFER_2H: menos de % de folga em relação ao job #% (% – %). Requer aprovação da supervisora com motivo.',
          v_buffer, v_conflito_buffer.codigo, v_conflito_buffer.inicio, v_conflito_buffer.fim using errcode = 'P0003';
      end if;
    end if;
  end if;

  -- RF-42: bloqueio preventivo de "Concluído" sem os dois comprovantes de 99
  if new.status = 'concluido' and (tg_op = 'INSERT' or old.status <> 'concluido') and new.precisa_99 then
    select count(*) filter (where sentido = 'ida' and comprovante_path is not null),
           count(*) filter (where sentido = 'volta' and comprovante_path is not null)
      into v_ida, v_volta from public.corrida_99 where job_id = new.id;
    if coalesce(v_ida, 0) = 0 or coalesce(v_volta, 0) = 0 then
      raise exception 'COMPROVANTES_99_FALTANDO: anexe os comprovantes de ida e volta antes de concluir o job'
        using errcode = 'P0004';
    end if;
  end if;

  -- Ponto geográfico: ao definir/alterar, exige confirmação manual (RF-36)
  if tg_op = 'UPDATE' and (new.ponto::text is distinct from old.ponto::text) and new.ponto_confirmado = old.ponto_confirmado then
    new.ponto_confirmado := false;
  end if;

  return new;
end $$;

create trigger job_validar before insert or update on public.job
  for each row execute function public.tg_job_validar();

-- Após gravar: registra exceções aprovadas e enfileira integrações
create or replace function public.tg_job_pos_gravacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dup boolean; v_buf boolean;
  v_buffer interval := make_interval(mins => public.cfg_int('buffer_minimo_minutos'));
begin
  if new.status <> 'cancelado' and coalesce(new.excecao_motivo, '') <> ''
     and (tg_op = 'INSERT' or new.excecao_motivo is distinct from old.excecao_motivo
          or new.data <> old.data or new.slot <> old.slot or new.fast_id <> old.fast_id) then
    select exists (select 1 from public.job j where j.fast_id = new.fast_id and j.data = new.data and j.status <> 'cancelado' and j.id <> new.id) into v_dup;
    select exists (select 1 from public.job j where j.fast_id = new.fast_id and j.status <> 'cancelado' and j.id <> new.id
                     and tstzrange(j.inicio - v_buffer, j.fim + v_buffer, '()') && tstzrange(new.inicio, new.fim, '[)')) into v_buf;
    if v_dup then
      insert into public.excecao (job_id, tipo, motivo, solicitada_por, aprovada, decidida_por, decidida_em)
      values (new.id, 'agendamento_duplo', new.excecao_motivo, auth.uid(), true, auth.uid(), now());
    end if;
    if v_buf then
      insert into public.excecao (job_id, tipo, motivo, solicitada_por, aprovada, decidida_por, decidida_em)
      values (new.id, 'buffer_2h', new.excecao_motivo, auth.uid(), true, auth.uid(), now());
    end if;
  end if;

  -- Troca de Fast registrada como exceção (RF-53)
  if tg_op = 'UPDATE' and new.fast_id <> old.fast_id then
    insert into public.excecao (job_id, tipo, motivo, solicitada_por, aprovada, decidida_por, decidida_em)
    values (new.id, 'troca_fast', coalesce(new.excecao_motivo, 'Fast responsável ajustado pela supervisora'), auth.uid(), true, auth.uid(), now());
  end if;

  -- Integrações (RF-60, RF-61, RF-62, RF-16) — idempotentes por chave
  perform public.enfileirar_integracao('notion_upsert', 'notion:job:' || new.id, jsonb_build_object('job_id', new.id));
  if tg_op = 'INSERT' then
    perform public.enfileirar_integracao('drive_verificar', 'drive:job:' || new.id, jsonb_build_object('job_id', new.id));
    perform public.enfileirar_integracao('calendar_upsert', 'calendar:job:' || new.id, jsonb_build_object('job_id', new.id));
    perform public.enfileirar_integracao('whatsapp_send', 'wa:novo-job:' || new.id, jsonb_build_object('job_id', new.id, 'evento', 'novo_job'));
  elsif new.status = 'cancelado' and old.status <> 'cancelado' then
    perform public.enfileirar_integracao('calendar_delete', 'calendar:cancel:' || new.id, jsonb_build_object('job_id', new.id));
    perform public.enfileirar_integracao('whatsapp_send', 'wa:cancelado:' || new.id, jsonb_build_object('job_id', new.id, 'evento', 'cancelado'));
  elsif new.data <> old.data or new.slot <> old.slot or new.fast_id <> old.fast_id or new.data_edicao is distinct from old.data_edicao or new.bloco_edicao is distinct from old.bloco_edicao then
    perform public.enfileirar_integracao('calendar_upsert', 'calendar:job:' || new.id || ':' || extract(epoch from now())::bigint, jsonb_build_object('job_id', new.id));
    perform public.enfileirar_integracao('whatsapp_send', 'wa:reagendado:' || new.id || ':' || extract(epoch from now())::bigint, jsonb_build_object('job_id', new.id, 'evento', 'reagendado'));
  end if;
  return new;
end $$;

create trigger job_pos_gravacao after insert or update on public.job
  for each row execute function public.tg_job_pos_gravacao();

-- ---------- Briefing recebido → status e flags (RF-20, RF-40) ----------
create or replace function public.tg_briefing_pos_gravacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.job
     set status = case when status = 'aguardando_briefing' then 'briefing_recebido'::public.job_status else status end,
         precisa_99 = new.precisa_99,
         endereco = coalesce(endereco, new.local)
   where id = new.job_id;
  perform public.enfileirar_integracao('email_send', 'email:briefing:' || new.job_id, jsonb_build_object('job_id', new.job_id, 'evento', 'briefing_recebido'));
  update public.alerta set resolvido = true, resolvido_em = now() where job_id = new.job_id and tipo = 'briefing_atrasado' and not resolvido;
  return new;
end $$;

create trigger briefing_pos_gravacao after insert or update on public.briefing
  for each row execute function public.tg_briefing_pos_gravacao();

-- ---------- Evento de localização: geofence, precisão, janela, consentimento ----------
create or replace function public.tg_evento_localizacao_validar() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_job public.job%rowtype;
  v_fast public.fast%rowtype;
  v_precisao_max numeric := public.cfg_int('precisao_maxima_m');
  v_antes interval := make_interval(mins => public.cfg_int('janela_checkin_antes_min'));
  v_depois interval := make_interval(mins => public.cfg_int('janela_checkin_depois_min'));
  v_versao text := public.cfg_text('versao_termo_vigente');
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

create trigger evento_localizacao_validar before insert on public.evento_localizacao
  for each row execute function public.tg_evento_localizacao_validar();

create or replace function public.tg_evento_localizacao_pos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_chegada timestamptz;
  v_precisao_max numeric := public.cfg_int('precisao_maxima_m');
begin
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

create trigger evento_localizacao_pos after insert on public.evento_localizacao
  for each row execute function public.tg_evento_localizacao_pos();

-- Eventos de localização são imutáveis (auditabilidade)
create or replace function public.tg_bloquear_alteracao() returns trigger
language plpgsql as $$
begin
  if not public.eh_sistema() then
    raise exception 'IMUTAVEL: registros de % não podem ser alterados', tg_table_name using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger evento_localizacao_imutavel before update or delete on public.evento_localizacao
  for each row execute function public.tg_bloquear_alteracao();

-- ---------- Corrida 99: divergência de destino (RF-43) ----------
create or replace function public.tg_corrida_99_validar() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_job public.job%rowtype;
begin
  select * into v_job from public.job where id = new.job_id;
  if new.destino_ponto is not null and v_job.ponto is not null and new.sentido = 'ida' then
    new.divergencia_destino := st_distance(v_job.ponto, new.destino_ponto) > v_job.raio_geofence_m;
  end if;
  return new;
end $$;
create trigger corrida_99_validar before insert or update on public.corrida_99
  for each row execute function public.tg_corrida_99_validar();

create or replace function public.tg_corrida_99_pos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.divergencia_destino, false) then
    insert into public.alerta (job_id, tipo, severidade, mensagem)
    values (new.job_id, 'destino_divergente', 'atencao', 'Destino da corrida de ida diverge da geofence do job')
    on conflict (job_id, tipo) where not resolvido do nothing;
  end if;
  if exists (select 1 from public.corrida_99 c where c.job_id = new.job_id and c.sentido = 'ida' and c.comprovante_path is not null)
     and exists (select 1 from public.corrida_99 c where c.job_id = new.job_id and c.sentido = 'volta' and c.comprovante_path is not null) then
    update public.alerta set resolvido = true, resolvido_em = now() where job_id = new.job_id and tipo = 'comprovante_faltando' and not resolvido;
  end if;
  perform public.enfileirar_integracao('notion_upsert', 'notion:job:' || new.job_id, jsonb_build_object('job_id', new.job_id));
  return new;
end $$;
create trigger corrida_99_pos after insert or update on public.corrida_99
  for each row execute function public.tg_corrida_99_pos();

-- ---------- Exceção: resolver alerta ao decidir ----------
create or replace function public.tg_excecao_pos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.aprovada is null then
    insert into public.alerta (job_id, tipo, severidade, mensagem)
    values (new.job_id, 'excecao_pendente', 'atencao', format('Exceção %s aguardando decisão: %s', new.tipo, new.motivo))
    on conflict (job_id, tipo) where not resolvido do nothing;
  elsif tg_op = 'UPDATE' and new.aprovada is not null and old.aprovada is null then
    if not exists (select 1 from public.excecao e where e.job_id = new.job_id and e.aprovada is null and e.id <> new.id) then
      update public.alerta set resolvido = true, resolvido_por = auth.uid(), resolvido_em = now()
       where job_id = new.job_id and tipo = 'excecao_pendente' and not resolvido;
    end if;
  end if;
  return new;
end $$;
create trigger excecao_pos after insert or update on public.excecao
  for each row execute function public.tg_excecao_pos();

-- ============================================================
-- RPCs (funções chamadas pelo app)
-- ============================================================

-- Registrar evento de localização (RF-31, RF-32, RF-37 offline com chave idempotente)
create or replace function public.registrar_evento_localizacao(
  p_job_id uuid, p_tipo public.evento_localizacao_tipo, p_lat double precision, p_lng double precision,
  p_precisao_m numeric, p_capturado_em timestamptz default now(), p_justificativa text default null,
  p_chave text default null, p_offline boolean default false
) returns public.evento_localizacao
language plpgsql security invoker set search_path = public, extensions as $$
declare
  v_fast_id uuid := public.auth_fast_id();
  v_row public.evento_localizacao;
begin
  if v_fast_id is null then
    raise exception 'SEM_PERFIL_FAST: apenas Fasts registram eventos de localização' using errcode = '42501';
  end if;
  if p_chave is not null then
    select * into v_row from public.evento_localizacao where chave_idempotencia = p_chave;
    if found then return v_row; end if;
  end if;
  insert into public.evento_localizacao (job_id, fast_id, tipo, ponto, precisao_m, capturado_em, justificativa, chave_idempotencia, origem_offline)
  values (p_job_id, v_fast_id, p_tipo, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::extensions.geography, p_precisao_m, p_capturado_em, nullif(p_justificativa, ''), p_chave, p_offline)
  returning * into v_row;
  return v_row;
end $$;

-- Definir/confirmar o ponto geográfico do job (RF-36)
create or replace function public.definir_ponto_job(
  p_job_id uuid, p_lat double precision, p_lng double precision, p_raio_m integer default null, p_confirmado boolean default true
) returns void
language plpgsql security invoker set search_path = public, extensions as $$
begin
  update public.job
     set ponto = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
         raio_geofence_m = coalesce(p_raio_m, raio_geofence_m),
         ponto_confirmado = p_confirmado
   where id = p_job_id;
  if not found then raise exception 'SEM_PERMISSAO_OU_JOB_INEXISTENTE' using errcode = '42501'; end if;
  -- ponto_confirmado é zerado pelo trigger quando o ponto muda; reaplica a confirmação explícita
  update public.job set ponto_confirmado = p_confirmado where id = p_job_id;
end $$;

-- Fast marca material bruto entregue (Processos 1.3)
create or replace function public.marcar_material_entregue(p_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_job public.job%rowtype;
begin
  select * into v_job from public.job where id = p_job_id;
  if v_job.id is null then raise exception 'JOB_INEXISTENTE'; end if;
  if not (public.eh_gestao() or v_job.fast_id = public.auth_fast_id()) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  if v_job.status <> 'em_gravacao' then
    raise exception 'STATUS_INVALIDO: material só pode ser marcado a partir de "em_gravacao" (atual %)', v_job.status;
  end if;
  update public.job set status = 'material_entregue', material_entregue_em = now() where id = p_job_id;
  update public.alerta set resolvido = true, resolvido_em = now() where job_id = p_job_id and tipo = 'material_nao_entregue_24h' and not resolvido;
end $$;

-- Supervisora decide exceção (RF-53)
create or replace function public.decidir_excecao(p_excecao_id uuid, p_aprovada boolean, p_parecer text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_gestao() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  update public.excecao set aprovada = p_aprovada, decidida_por = auth.uid(), decidida_em = now(), parecer = p_parecer
   where id = p_excecao_id and aprovada is null;
  if not found then raise exception 'EXCECAO_INEXISTENTE_OU_JA_DECIDIDA'; end if;
end $$;

-- Cancelar job (RF-15)
create or replace function public.cancelar_job(p_job_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_job public.job%rowtype;
begin
  select * into v_job from public.job where id = p_job_id;
  if v_job.id is null then raise exception 'JOB_INEXISTENTE'; end if;
  if not (public.eh_gestao() or v_job.analista_id = auth.uid() or v_job.criado_por = auth.uid()) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  if coalesce(p_motivo, '') = '' then raise exception 'MOTIVO_OBRIGATORIO'; end if;
  update public.job set status = 'cancelado', motivo_cancelamento = p_motivo, cancelado_em = now() where id = p_job_id;
end $$;

-- Aceite do termo de ciência
create or replace function public.aceitar_termo(p_versao text, p_user_agent text default null) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.consentimento (usuario_id, versao_termo, user_agent)
  values (auth.uid(), p_versao, p_user_agent)
  on conflict (usuario_id, versao_termo) do nothing;
end $$;

-- Consulta de posições — apenas gestão, sempre logada (RNF-04, seção 8 "Acesso")
create or replace function public.mapa_do_dia(p_data date default current_date)
returns table (
  fast_id uuid, fast_nome text, cor text, job_id uuid, codigo bigint, cliente text, status public.job_status,
  tipo public.evento_localizacao_tipo, lat double precision, lng double precision, precisao_m numeric,
  capturado_em timestamptz, dentro_geofence boolean, job_lat double precision, job_lng double precision, raio_geofence_m integer
)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.eh_gestao() then raise exception 'SEM_PERMISSAO' using errcode = '42501'; end if;
  insert into public.auditoria (usuario_id, usuario_email, acao, entidade, entidade_id, dados)
  values (auth.uid(), auth.jwt() ->> 'email', 'consulta_posicao', 'mapa_do_dia', p_data::text, jsonb_build_object('data', p_data));

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

create or replace function public.consultar_localizacoes_job(p_job_id uuid)
returns table (
  id uuid, tipo public.evento_localizacao_tipo, lat double precision, lng double precision, precisao_m numeric,
  capturado_em timestamptz, dentro_geofence boolean, distancia_m numeric, justificativa text, origem_offline boolean
)
language plpgsql security definer set search_path = public, extensions as $$
declare v_job public.job%rowtype;
begin
  select * into v_job from public.job where job.id = p_job_id;
  if v_job.id is null then raise exception 'JOB_INEXISTENTE'; end if;
  if not (public.eh_gestao() or v_job.fast_id = public.auth_fast_id()) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  if public.eh_gestao() then
    insert into public.auditoria (usuario_id, usuario_email, acao, entidade, entidade_id, dados)
    values (auth.uid(), auth.jwt() ->> 'email', 'consulta_posicao', 'job', p_job_id::text, jsonb_build_object('fast_id', v_job.fast_id));
  end if;
  return query
  select e.id, e.tipo, st_y(e.ponto::geometry), st_x(e.ponto::geometry), e.precisao_m, e.capturado_em,
         e.dentro_geofence, e.distancia_m, e.justificativa, e.origem_offline
    from public.evento_localizacao e where e.job_id = p_job_id order by e.capturado_em;
end $$;

-- Coordenadas do job (ponto da geofence) para o app, sem expor geometria bruta
create or replace function public.job_coordenadas(p_job_id uuid)
returns table (lat double precision, lng double precision, raio_geofence_m integer, ponto_confirmado boolean)
language sql stable security invoker set search_path = public, extensions as $$
  select st_y(ponto::geometry), st_x(ponto::geometry), raio_geofence_m, ponto_confirmado
    from public.job where id = p_job_id
$$;

-- ============================================================
-- Rotinas periódicas (pg_cron): alertas e retenção
-- ============================================================
create or replace function public.gerar_alertas_periodicos() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_total integer := 0;
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
  on conflict (job_id, tipo) where not resolvido do nothing;
  get diagnostics v_total = row_count;

  -- RF-52: atraso de check-in
  insert into public.alerta (job_id, tipo, severidade, mensagem)
  select j.id, 'checkin_atrasado', 'critico', format('Sem check-in no job #%s, iniciado às %s', j.codigo, to_char(j.inicio at time zone v_tz, 'HH24:MI'))
    from public.job j
   where j.status = 'briefing_recebido' and now() > j.inicio + v_atraso and now() < j.fim + interval '12 hours'
     and not exists (select 1 from public.evento_localizacao e where e.job_id = j.id and e.tipo = 'chegada')
  on conflict (job_id, tipo) where not resolvido do nothing;

  -- RF-52 / Processos 1.3: material bruto não entregue em 24h
  insert into public.alerta (job_id, tipo, severidade, mensagem)
  select j.id, 'material_nao_entregue_24h', 'atencao', format('Material bruto do job #%s não entregue em %sh', j.codigo, public.cfg_int('prazo_material_horas'))
    from public.job j
   where j.status = 'em_gravacao' and now() > j.fim + v_prazo
  on conflict (job_id, tipo) where not resolvido do nothing;

  -- RF-52 / Processos 3.2: comprovante de 99 faltando
  insert into public.alerta (job_id, tipo, severidade, mensagem)
  select j.id, 'comprovante_faltando', 'atencao', format('Job #%s precisa de 99 e ainda não tem os dois comprovantes', j.codigo)
    from public.job j
   where j.precisa_99 and j.status in ('material_entregue', 'em_edicao') and j.data < v_hoje
     and (not exists (select 1 from public.corrida_99 c where c.job_id = j.id and c.sentido = 'ida' and c.comprovante_path is not null)
       or not exists (select 1 from public.corrida_99 c where c.job_id = j.id and c.sentido = 'volta' and c.comprovante_path is not null))
  on conflict (job_id, tipo) where not resolvido do nothing;
  return v_total;
end $$;

-- RNF-04 / seção 8: exclusão automática dos eventos de localização
create or replace function public.expurgar_eventos_localizacao() returns integer
language plpgsql security definer set search_path = public as $$
declare v_dias integer := public.cfg_int('retencao_localizacao_dias'); v_qtd integer;
begin
  delete from public.evento_localizacao where capturado_em < now() - make_interval(days => v_dias);
  get diagnostics v_qtd = row_count;
  insert into public.auditoria (acao, entidade, dados)
  values ('expurgo_retencao', 'evento_localizacao', jsonb_build_object('dias', v_dias, 'excluidos', v_qtd));
  return v_qtd;
end $$;

select cron.schedule('fmt-alertas-periodicos', '*/15 * * * *', $$select public.gerar_alertas_periodicos()$$);
select cron.schedule('fmt-expurgo-localizacao', '15 3 * * *', $$select public.expurgar_eventos_localizacao()$$);
