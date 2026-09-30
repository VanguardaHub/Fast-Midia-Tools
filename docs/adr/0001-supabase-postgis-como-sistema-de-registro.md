# ADR-0001 — Supabase (Postgres + PostGIS) como sistema de registro; Notion como espelho

**Status:** Aceito (decisão 2 da seção 14, exercida pela gerência do projeto em 30/09/2026)
**Contexto:** O Notion não tem tipo geográfico, limita ~3 req/s e não oferece permissão por linha. O Apps Script bloqueia a Geolocation API no iframe e não tem tempo real (seção 2.3).
**Decisão:** Postgres gerenciado (Supabase) com PostGIS, Auth, RLS, Storage e pg_cron como fonte da verdade; Notion recebe espelho de status e campos por fila idempotente para preservar as views atuais da supervisora. Região `sa-east-1` (São Paulo) para residência de dados no Brasil.
**Consequências:** Regras de negócio aplicadas por trigger/constraint; custo do plano Supabase a estimar na Fase 1 (hoje plano gratuito, adequado ao piloto); dependência de um provedor gerenciado, mitigada por migrações versionadas e Postgres padrão (portável).
**Alternativas rejeitadas:** Postgres próprio com API dedicada (mais esforço, sem ganho no prazo); Notion como fonte (limites técnicos e de privacidade).
