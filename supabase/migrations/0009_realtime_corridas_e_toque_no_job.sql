-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0009: Realtime também para corridas e para eventos do tipo "corrida"
-- Cada evento de localização atualiza job.atualizado_em, de modo que o Realtime (job) notifique o mapa
-- mesmo quando o evento não muda o status (ex.: tipo corrida). Posições continuam só pela RPC auditada.
-- ============================================================
alter publication supabase_realtime add table public.corrida_99;

create or replace function public.tg_evento_localizacao_toque_job() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.job set atualizado_em = now() where id = new.job_id;
  return new;
end $$;
create trigger evento_localizacao_toque_job after insert on public.evento_localizacao
  for each row execute function public.tg_evento_localizacao_toque_job();
