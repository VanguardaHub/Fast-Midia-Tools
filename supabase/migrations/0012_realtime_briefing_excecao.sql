-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0012: Realtime em todas as telas
-- Publica briefing e excecao (job, alerta e corrida_99 já publicados em 0008/0009).
-- Com isso, agenda, Kanban, detalhe do job, app de campo, alertas e a visão do analista
-- recarregam sozinhos quando outra pessoa altera algo. Realtime respeita RLS.
-- evento_localizacao continua fora da publicação (ADR-0003/0005): o mapa é acionado
-- pelo toque em job.atualizado_em.
-- ============================================================
alter publication supabase_realtime add table public.briefing;
alter publication supabase_realtime add table public.excecao;
