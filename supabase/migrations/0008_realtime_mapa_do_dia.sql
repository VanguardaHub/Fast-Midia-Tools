-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0008: Realtime para o Mapa do dia (RF-51, "tempo quase real")
-- Publica mudanças de job (status muda no check-in/out) e alerta.
-- evento_localizacao NÃO é publicada: posições só saem pela RPC auditada (RNF-04, ADR-0003).
-- Realtime respeita RLS: cada perfil recebe apenas as linhas que pode ler.
-- ============================================================
alter publication supabase_realtime add table public.job;
alter publication supabase_realtime add table public.alerta;
