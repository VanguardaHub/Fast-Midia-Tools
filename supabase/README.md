# Banco de dados — Supabase

Projeto: **fast-midia-tools** · ref `wcidhqxkoltwfrlairqj` · região `sa-east-1` (São Paulo) · Postgres 17 · PostGIS 3.3

## Migrações (aplicadas em ordem; já aplicadas no projeto)

| Arquivo | Conteúdo |
|---|---|
| `0001_extensoes_e_tipos.sql` | postgis, btree_gist, pg_cron; enums; `configuracao` com parâmetros operacionais |
| `0002_tabelas.sql` | perfil, convite, fast, cliente, job (geofence, exclusão GiST), briefing, evento_localizacao, corrida_99, excecao, alerta, auditoria, termo_ciencia, consentimento, fila_integracao |
| `0003_regras_de_negocio.sql` | helpers de identidade, auditoria genérica, outbox, validação de domínio no signup, buffer 2h / duplo / atômico, briefing obrigatório, geofence/precisão/janela/consentimento, bloqueio de Concluído, RPCs, alertas e retenção (pg_cron) |
| `0004_rls_e_storage.sql` | RLS por perfil em todas as tabelas; grants das RPCs; buckets privados |
| `0005_views_analiticas.sql` | schema `analytics`: `vw_jobs`, `vw_gasto_99`, `vw_gasto_99_por_fast_dia`, `indicadores_okr()` |
| `0006_ajustes_advisors.sql` | search_path fixo, initplan de RLS, índices de FK, políticas duplicadas |

## Reaplicar do zero

```bash
supabase link --project-ref <ref>
supabase db push          # aplica supabase/migrations em ordem
supabase gen types typescript --project-id <ref> > web/src/lib/database.types.ts
```

## Códigos de erro de regra de negócio

| SQLSTATE | Código | Regra |
|---|---|---|
| P0001 | EMAIL_NAO_AUTORIZADO | RF-01 |
| P0002 | AGENDAMENTO_DUPLO | RF-13 |
| P0003 | BUFFER_2H | RF-12 |
| P0004 | COMPROVANTES_99_FALTANDO | RF-42 |
| P0005 | CONSENTIMENTO_PENDENTE | seção 8 |
| P0006 | FORA_DA_JANELA | RF-35 |
| P0007 | SEM_BRIEFING | RF-21 |
| P0008 | STATUS_INVALIDO_PARA_CHECKIN | RF-31 |
| P0009 | SEM_CHECKIN | RF-32 |
| P0010 | BAIXA_PRECISAO_SEM_JUSTIFICATIVA | RNF-06 |
| P0011 | FORA_GEOFENCE_SEM_JUSTIFICATIVA | RF-34 |

## Primeiro acesso

O **primeiro usuário** que se autenticar recebe o perfil `admin` (bootstrap). Depois, perfis são definidos em Cadastros → Acessos.

## Smoke test

O fluxo completo (signup por domínio, bloqueio de duplo, aprovação com motivo, consentimento, check-in sem briefing, geofence, idempotência offline, check-out, material entregue, bloqueio de Concluído, conciliação, mapa auditado, OKRs) foi executado em transação com rollback em 30/09/2026 — ver `docs/pesquisa/evidencias/smoke-test-2026-09-30.md`.
