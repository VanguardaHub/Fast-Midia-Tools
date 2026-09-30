-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0006: ajustes apontados pelos advisors do Supabase
-- Critério de saída 1.1 (EAP): "advisors de segurança sem alertas críticos"
-- ============================================================

-- search_path fixo em todas as funções (lint 0011)
alter function public.cfg_int(text) set search_path = public;
alter function public.cfg_text(text) set search_path = public;
alter function public.cfg_json(text) set search_path = public;
alter function public.eh_gestao() set search_path = public;
alter function public.eh_admin() set search_path = public;
alter function public.eh_sistema() set search_path = public;
alter function public.job_intervalo(date, public.slot_tipo) set search_path = public;
alter function public.tg_atualizado_em() set search_path = public;
alter function public.tg_perfil_proteger() set search_path = public;
alter function public.tg_bloquear_alteracao() set search_path = public;

-- RLS: auth.<fn>() e helpers avaliados uma vez por consulta (lint 0003)
drop policy perfil_proprio_select on public.perfil;
create policy perfil_proprio_select on public.perfil for select to authenticated
  using (id = (select auth.uid()) or (select public.eh_gestao()));
drop policy perfil_proprio_update on public.perfil;
create policy perfil_proprio_update on public.perfil for update to authenticated
  using (id = (select auth.uid()) or (select public.eh_admin()))
  with check (id = (select auth.uid()) or (select public.eh_admin()));

drop policy job_select on public.job;
create policy job_select on public.job for select to authenticated
  using ((select public.eh_gestao()) or fast_id = (select public.auth_fast_id())
         or analista_id = (select auth.uid()) or criado_por = (select auth.uid()));
drop policy job_update on public.job;
create policy job_update on public.job for update to authenticated
  using ((select public.eh_gestao()) or ((select public.auth_perfil()) = 'analista' and (analista_id = (select auth.uid()) or criado_por = (select auth.uid()))))
  with check ((select public.eh_gestao()) or ((select public.auth_perfil()) = 'analista' and (analista_id = (select auth.uid()) or criado_por = (select auth.uid()))));

drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using ((select public.eh_gestao()) or usuario_id = (select auth.uid()));

drop policy consentimento_select on public.consentimento;
create policy consentimento_select on public.consentimento for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.eh_gestao()));
drop policy consentimento_insert on public.consentimento;
create policy consentimento_insert on public.consentimento for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- Políticas permissivas duplicadas para SELECT (lint 0006)
drop policy configuracao_admin on public.configuracao;
create policy configuracao_admin_insert on public.configuracao for insert to authenticated with check ((select public.eh_admin()));
create policy configuracao_admin_update on public.configuracao for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy configuracao_admin_delete on public.configuracao for delete to authenticated using ((select public.eh_admin()));

drop policy termo_admin on public.termo_ciencia;
create policy termo_admin_insert on public.termo_ciencia for insert to authenticated with check ((select public.eh_admin()));
create policy termo_admin_update on public.termo_ciencia for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy termo_admin_delete on public.termo_ciencia for delete to authenticated using ((select public.eh_admin()));

-- Índices de cobertura para chaves estrangeiras (lint 0001)
create index alerta_resolvido_por_idx on public.alerta (resolvido_por);
create index briefing_preenchido_por_idx on public.briefing (preenchido_por);
create index consentimento_versao_idx on public.consentimento (versao_termo);
create index convite_criado_por_idx on public.convite (criado_por);
create index corrida_99_registrado_por_idx on public.corrida_99 (registrado_por);
create index corrida_99_validada_por_idx on public.corrida_99 (validada_por);
create index excecao_decidida_por_idx on public.excecao (decidida_por);
create index excecao_solicitada_por_idx on public.excecao (solicitada_por);
create index job_analista_idx on public.job (analista_id);
create index job_cliente_idx on public.job (cliente_id);
create index job_criado_por_idx on public.job (criado_por);

-- Observações registradas (não são defeitos):
--  * fila_integracao sem política: acesso exclusivo do service_role (worker). Intencional.
--  * RPCs SECURITY DEFINER executáveis por authenticated: cada uma valida perfil/propriedade
--    internamente e registra auditoria (mapa_do_dia, consultar_localizacoes_job, decidir_excecao,
--    cancelar_job, marcar_material_entregue). auth_perfil/auth_fast_id/pode_ver_job devolvem
--    apenas dados do próprio chamador.
