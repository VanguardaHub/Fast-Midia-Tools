# Arquitetura — Fast Mídia Tools 2.0

Referência: seção 7 do Documento de Escopo (arquitetura alvo em 3 camadas; migração gradual com o fluxo atual ativo até o go/no-go).

```
┌──────────────────────────────┐      ┌──────────────────────────────┐
│  PWA de campo (Fast)         │      │  Painel (Supervisora/Admin/  │
│  Next.js 16 · React 19       │      │  Analista) — mesmo app       │
│  check-in/out · briefing ·   │      │  agenda · kanban · mapa ·    │
│  comprovantes · offline      │      │  alertas · indicadores       │
└──────────────┬───────────────┘      └──────────────┬───────────────┘
               │ HTTPS · JWT (cookie)                │
               ▼                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vercel (gru1) — Next.js App Router                              │
│  Server Actions · Route Handlers · Proxy de sessão               │
│  /api/integracoes/processar (cron 10 min, CRON_SECRET)           │
└──────────────┬───────────────────────────────────────────────────┘
               │ supabase-js (RLS)          │ service_role (só worker)
               ▼                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  Supabase — sa-east-1 (São Paulo) · Postgres 17 + PostGIS 3.3    │
│  Auth · RLS por perfil · triggers de regras · auditoria          │
│  pg_cron: alertas (15 min) · expurgo de localização (diário)     │
│  Storage privado: comprovantes-99 · referencias-briefing         │
│  schema analytics: views/função para painel e Power BI           │
│  fila_integracao (outbox idempotente)                            │
└──────────────┬───────────────────────────────────────────────────┘
               │ worker (fila)
     ┌─────────┼──────────────┬──────────────┬─────────────┐
     ▼         ▼              ▼              ▼             ▼
 Apps Script  Notion       WhatsApp       E-mail       Power BI
 (Calendar/   (espelho     Cloud API      (Resend)     (conexão
  Drive)      de status)                               às views)
```

## Componentes

| Componente | Tecnologia | Justificativa (escopo 7.1) |
|---|---|---|
| App de campo e painel | Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript 5, Tailwind 4, MapLibre GL, PWA (manifest + service worker) | Uma base web instalável, alinhada à competência do time |
| Backend e banco | Supabase: Postgres 17, PostGIS, Auth, RLS, Storage, pg_cron | Geofence, distância e permissão por linha prontas; região Brasil |
| Integração Calendar/Drive | Apps Script como serviço interno (endpoint com token) | Reaproveita código e permissões atuais |
| Notion | Espelho de status e campos via fila | Mantém as views atuais da supervisora |
| Notificações | WhatsApp Cloud API com e-mail de contingência | Sandbox não serve para produção; chip pendente |
| Observabilidade | Logs do Vercel e do Supabase; advisors; auditoria no banco | Continuidade e auditoria |

## Modelo de dados (migrações em `supabase/migrations/`)

| Tabela | Papel | RF/RNF |
|---|---|---|
| `perfil`, `convite` | Identidade e perfis (fast, analista, supervisora, admin); domínio corporativo + convites | RF-01, RF-02 |
| `fast` | Cadastro de Fasts (substitui `CONFIG.FASTS`) | RF-03 |
| `cliente` | Cliente e pasta no Drive | RF-16 |
| `job` | Job com slot, intervalo, status, geofence (`ponto` geography + raio), flags | RF-10..16, RF-33, RF-50 |
| `briefing` | Briefing obrigatório | RF-20..22 |
| `evento_localizacao` | Chegada, saída, corrida; distância e geofence calculadas; imutável; retenção 90 dias | RF-31..37, RNF-04 |
| `corrida_99` | Ida/volta, valor, comprovante, validação, divergência de destino | RF-40..44 |
| `excecao` | Decisões da supervisora | RF-53, Processos 6 |
| `alerta` | Alertas operacionais | RF-52 |
| `auditoria` | Trilha de auditoria, consultas de posição, expurgo | RNF-12, RNF-04 |
| `termo_ciencia`, `consentimento` | Termo versionado e aceite | Seção 8 |
| `configuracao` | Parâmetros (buffer, raio, precisão, retenção, janela, domínios) | RF-33, RNF-06 |
| `fila_integracao` | Outbox idempotente | RNF-07, RNF-08 |

### Regras aplicadas pelo banco (migração 0003)

- **RF-12/RF-13**: trigger `tg_job_validar` bloqueia buffer < 2h e agendamento duplo; só Supervisora/Admin com `excecao_motivo` passa, gerando `excecao` aprovada.
- **RF-14**: índice único parcial `(fast_id, data, slot)` + constraint de exclusão GiST por intervalo — bloqueio atômico sem race condition.
- **RF-21**: check-in exige briefing; **RF-35**: janela do job; **RF-34/RNF-06**: fora da geofence ou precisão > 100 m exige justificativa e vira alerta + exceção pendente.
- **RF-42**: `status = concluido` recusado sem os dois comprovantes quando `precisa_99`.
- **Consentimento**: nenhum evento de localização sem aceite do termo vigente.
- **RNF-04**: consultas de posição só por RPC `mapa_do_dia` / `consultar_localizacoes_job`, que registram auditoria; expurgo diário por `pg_cron`.

## Segurança (RNF-01..03)

- Nenhum endpoint público: `proxy.ts` exige sessão; RLS em todas as tabelas; `fila_integracao` só para `service_role`.
- Segredos apenas em variáveis de ambiente do Vercel (`.env.example` documenta); CI com gitleaks.
- HTTPS + HSTS; `Permissions-Policy: geolocation=(self)`; buckets privados com URLs assinadas de curta duração.
- Advisors do Supabase: sem alertas críticos (migração 0006 corrigiu `search_path`, initplan de RLS, índices de FK).

## Ambientes

| Ambiente | Supabase | Vercel |
|---|---|---|
| Produção | projeto `fast-midia-tools` (`wcidhqxkoltwfrlairqj`) | deploy da branch `main` |
| Dev/preview | branch de banco do Supabase (Branching) ou projeto separado | preview por PR |

## Power BI (RF-54)

Conectar ao Postgres do Supabase (host `db.wcidhqxkoltwfrlairqj.supabase.co`, porta 5432, SSL) com um usuário de leitura dedicado, com `GRANT USAGE ON SCHEMA analytics` e `SELECT` nas views `analytics.vw_jobs`, `analytics.vw_gasto_99`, `analytics.vw_gasto_99_por_fast_dia`. Criar o usuário pelo SQL Editor (não versionar a senha). As views não expõem geometria bruta.

## Contrato do serviço interno Apps Script (Fase 0 / 1.3)

`POST APPS_SCRIPT_URL` com JSON `{ token, acao, job }`:

| `acao` | Entrada relevante | Saída |
|---|---|---|
| `calendar_upsert` | `fast_email, data, slot, inicio, fim, data_edicao, bloco_edicao, calendar_event_id?` | `{ ok, calendar_event_id, calendar_event_edicao_id? }` |
| `calendar_delete` | `calendar_event_id, calendar_event_edicao_id` | `{ ok }` |
| `drive_verificar` | `cliente, cliente_pasta_id?, cliente_grupo?, data` | `{ ok, pasta_ingest_url?, status: 'encontrado'\|'grupo'\|'nao_encontrado' }` |
| `GET ?acao=disponibilidade&inicio&fim&token` | — | `{ bloqueios: [{ fast_email, data, slot }] }` |

O Apps Script deve ser publicado com `access: DOMAIN` e validar o `token` (PropertiesService), conforme Fase 0.

## Operação

- **Worker**: `GET /api/integracoes/processar` com `Authorization: Bearer CRON_SECRET` (cron a cada 10 min). Backoff exponencial, máx. 5 tentativas, depois `descartado` (visível em Cadastros → Integrações).
- **Alertas**: `gerar_alertas_periodicos()` a cada 15 min (pg_cron).
- **Retenção**: `expurgar_eventos_localizacao()` diário às 03:15 UTC, registrado em `auditoria`.
- **Backup**: backups diários do Supabase (plano); exportação adicional recomendada antes do go-live.
- **Recuperação**: recriar o projeto Supabase aplicando `supabase/migrations/` em ordem; redeploy no Vercel.
