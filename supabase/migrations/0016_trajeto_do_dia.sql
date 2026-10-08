-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0016: Trajeto do dia (RF-51 + RF-38, ADR-0005 rev. 08/10)
-- O Mapa do dia passa a acompanhar o Fast como um app de corrida: além da última posição,
-- devolve a trilha (chegada → posições → saída) dos jobs da data, só para a gestão.
-- Nenhum dado novo é coletado: são os mesmos eventos de evento_localizacao, já limitados à
-- janela do job e à retenção de 7 dias (posições). Acesso auditado na MESMA janela de
-- auditoria do mapa (auditoria_mapa_janela_min), sob a entidade 'mapa_do_dia', para que a
-- transparência ao Fast (minhas_consultas_posicao) continue mostrando a consulta.
-- ============================================================
create or replace function public.trajeto_do_dia(p_data date default current_date)
returns table (
  job_id uuid, fast_id uuid, tipo public.evento_localizacao_tipo,
  lat double precision, lng double precision, precisao_m numeric, capturado_em timestamptz, dentro_geofence boolean
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
            jsonb_build_object('data', p_data, 'janela_min', extract(epoch from v_janela) / 60, 'trajeto', true));
  end if;

  return query
  select e.job_id, e.fast_id, e.tipo, st_y(e.ponto::geometry), st_x(e.ponto::geometry), e.precisao_m, e.capturado_em, e.dentro_geofence
    from public.evento_localizacao e
    join public.job j on j.id = e.job_id
   where j.data = p_data and j.status <> 'cancelado'
   order by e.job_id, e.capturado_em;
end $$;

revoke all on function public.trajeto_do_dia(date) from public;
grant execute on function public.trajeto_do_dia(date) to authenticated;
comment on function public.trajeto_do_dia(date) is
  'Trilha (chegada, posições, saída, corridas) dos jobs da data para o Mapa do dia ao vivo. Só gestão; auditada por janela como mapa_do_dia (ADR-0005).';
