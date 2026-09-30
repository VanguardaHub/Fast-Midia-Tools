-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0004: RLS por perfil (RF-02, RNF-01) e Storage
-- Princípio: cada Fast vê apenas o que é seu; gestão vê tudo; posições só via RPC logada.
-- ============================================================

alter table public.configuracao        enable row level security;
alter table public.perfil              enable row level security;
alter table public.convite             enable row level security;
alter table public.fast                enable row level security;
alter table public.cliente             enable row level security;
alter table public.job                 enable row level security;
alter table public.briefing            enable row level security;
alter table public.evento_localizacao  enable row level security;
alter table public.corrida_99          enable row level security;
alter table public.excecao             enable row level security;
alter table public.alerta              enable row level security;
alter table public.auditoria           enable row level security;
alter table public.termo_ciencia       enable row level security;
alter table public.consentimento       enable row level security;
alter table public.fila_integracao     enable row level security;

-- Visibilidade de job reutilizada em várias tabelas
create or replace function public.pode_ver_job(p_job_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job j
     where j.id = p_job_id
       and (public.eh_gestao()
            or j.fast_id = public.auth_fast_id()
            or j.analista_id = auth.uid()
            or j.criado_por = auth.uid())
  )
$$;

-- ---------- configuracao ----------
create policy configuracao_leitura on public.configuracao for select to authenticated using (true);
create policy configuracao_admin on public.configuracao for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- ---------- perfil ----------
create policy perfil_proprio_select on public.perfil for select to authenticated using (id = auth.uid() or public.eh_gestao());
create policy perfil_proprio_update on public.perfil for update to authenticated using (id = auth.uid() or public.eh_admin()) with check (id = auth.uid() or public.eh_admin());

-- ---------- convite ----------
create policy convite_gestao on public.convite for all to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

-- ---------- fast ----------
create policy fast_select on public.fast for select to authenticated using (true);
create policy fast_gestao on public.fast for insert to authenticated with check (public.eh_gestao());
create policy fast_gestao_update on public.fast for update to authenticated using (public.eh_gestao()) with check (public.eh_gestao());
create policy fast_admin_delete on public.fast for delete to authenticated using (public.eh_admin());

-- ---------- cliente ----------
create policy cliente_select on public.cliente for select to authenticated using (true);
create policy cliente_insert on public.cliente for insert to authenticated with check (public.eh_gestao() or public.auth_perfil() = 'analista');
create policy cliente_update on public.cliente for update to authenticated using (public.eh_gestao() or public.auth_perfil() = 'analista') with check (public.eh_gestao() or public.auth_perfil() = 'analista');
create policy cliente_admin_delete on public.cliente for delete to authenticated using (public.eh_admin());

-- ---------- job ----------
create policy job_select on public.job for select to authenticated
  using (public.eh_gestao() or fast_id = public.auth_fast_id() or analista_id = auth.uid() or criado_por = auth.uid());
create policy job_insert on public.job for insert to authenticated
  with check (public.eh_gestao() or public.auth_perfil() = 'analista');
-- Fast altera o job somente via RPCs (marcar_material_entregue, definir_ponto_job restrito a gestão/analista)
create policy job_update on public.job for update to authenticated
  using (public.eh_gestao() or (public.auth_perfil() = 'analista' and (analista_id = auth.uid() or criado_por = auth.uid())))
  with check (public.eh_gestao() or (public.auth_perfil() = 'analista' and (analista_id = auth.uid() or criado_por = auth.uid())));
create policy job_admin_delete on public.job for delete to authenticated using (public.eh_admin());

-- ---------- briefing ----------
create policy briefing_select on public.briefing for select to authenticated using (public.pode_ver_job(job_id));
create policy briefing_insert on public.briefing for insert to authenticated
  with check (public.pode_ver_job(job_id) and public.auth_perfil() in ('analista', 'supervisora', 'admin'));
create policy briefing_update on public.briefing for update to authenticated
  using (public.pode_ver_job(job_id) and public.auth_perfil() in ('analista', 'supervisora', 'admin'))
  with check (public.pode_ver_job(job_id) and public.auth_perfil() in ('analista', 'supervisora', 'admin'));

-- ---------- evento_localizacao ----------
-- Fast: insere e lê o próprio histórico. Gestão: NÃO lê diretamente — usa mapa_do_dia / consultar_localizacoes_job (logadas).
create policy evento_localizacao_fast_insert on public.evento_localizacao for insert to authenticated
  with check (fast_id = public.auth_fast_id());
create policy evento_localizacao_fast_select on public.evento_localizacao for select to authenticated
  using (fast_id = public.auth_fast_id());

-- ---------- corrida_99 ----------
create policy corrida_99_select on public.corrida_99 for select to authenticated using (public.pode_ver_job(job_id));
create policy corrida_99_insert on public.corrida_99 for insert to authenticated
  with check (public.eh_gestao() or exists (select 1 from public.job j where j.id = job_id and j.fast_id = public.auth_fast_id()));
create policy corrida_99_update on public.corrida_99 for update to authenticated
  using (public.eh_gestao() or (not validada and exists (select 1 from public.job j where j.id = job_id and j.fast_id = public.auth_fast_id())))
  with check (public.eh_gestao() or (not validada and exists (select 1 from public.job j where j.id = job_id and j.fast_id = public.auth_fast_id())));

-- ---------- excecao ----------
create policy excecao_select on public.excecao for select to authenticated using (public.pode_ver_job(job_id));
create policy excecao_insert on public.excecao for insert to authenticated with check (public.pode_ver_job(job_id));
create policy excecao_update on public.excecao for update to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

-- ---------- alerta ----------
create policy alerta_select on public.alerta for select to authenticated using (public.eh_gestao() or public.pode_ver_job(job_id));
create policy alerta_update on public.alerta for update to authenticated using (public.eh_gestao()) with check (public.eh_gestao());

-- ---------- auditoria ----------
create policy auditoria_select on public.auditoria for select to authenticated using (public.eh_gestao() or usuario_id = auth.uid());

-- ---------- termo / consentimento ----------
create policy termo_select on public.termo_ciencia for select to authenticated using (true);
create policy termo_admin on public.termo_ciencia for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy consentimento_select on public.consentimento for select to authenticated using (usuario_id = auth.uid() or public.eh_gestao());
create policy consentimento_insert on public.consentimento for insert to authenticated with check (usuario_id = auth.uid());

-- ---------- fila_integracao: apenas service_role (worker). Sem políticas = sem acesso a authenticated ----------

-- Permissões de execução das RPCs
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.registrar_evento_localizacao(uuid, public.evento_localizacao_tipo, double precision, double precision, numeric, timestamptz, text, text, boolean) to authenticated;
grant execute on function public.definir_ponto_job(uuid, double precision, double precision, integer, boolean) to authenticated;
grant execute on function public.marcar_material_entregue(uuid) to authenticated;
grant execute on function public.decidir_excecao(uuid, boolean, text) to authenticated;
grant execute on function public.cancelar_job(uuid, text) to authenticated;
grant execute on function public.aceitar_termo(text, text) to authenticated;
grant execute on function public.mapa_do_dia(date) to authenticated;
grant execute on function public.consultar_localizacoes_job(uuid) to authenticated;
grant execute on function public.job_coordenadas(uuid) to authenticated;
grant execute on function public.job_intervalo(date, public.slot_tipo) to authenticated;
grant execute on function public.auth_perfil() to authenticated;
grant execute on function public.auth_fast_id() to authenticated;
grant execute on function public.eh_gestao() to authenticated;
grant execute on function public.eh_admin() to authenticated;
grant execute on function public.eh_sistema() to authenticated;
grant execute on function public.pode_ver_job(uuid) to authenticated;
grant execute on function public.cfg_int(text) to authenticated;
grant execute on function public.cfg_text(text) to authenticated;
grant execute on function public.cfg_json(text) to authenticated;

-- ============================================================
-- Storage: comprovantes de 99 e referências visuais (privados)
-- Caminho: {job_id}/{arquivo}
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes-99', 'comprovantes-99', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
       ('referencias-briefing', 'referencias-briefing', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy storage_comprovantes_select on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes-99' and public.pode_ver_job(((storage.foldername(name))[1])::uuid));
create policy storage_comprovantes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes-99' and (
    public.eh_gestao() or exists (select 1 from public.job j where j.id = ((storage.foldername(name))[1])::uuid and j.fast_id = public.auth_fast_id())
  ));
create policy storage_comprovantes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes-99' and public.eh_gestao());

create policy storage_referencias_select on storage.objects for select to authenticated
  using (bucket_id = 'referencias-briefing' and public.pode_ver_job(((storage.foldername(name))[1])::uuid));
create policy storage_referencias_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'referencias-briefing' and public.pode_ver_job(((storage.foldername(name))[1])::uuid)
              and public.auth_perfil() in ('analista', 'supervisora', 'admin'));
