-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0007: expor o schema analytics na API (PostgREST)
-- Sem isto, /rest/v1 responde PGRST106 "Invalid schema: analytics" e o painel,
-- o Kanban e os indicadores mostram zero. Equivale a "Exposed schemas" no dashboard.
-- ============================================================
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, analytics';
notify pgrst, 'reload config';
