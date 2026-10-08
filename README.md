# Fast Mídia Tools

Plataforma interna do setor **Fast Mídia** (Vanguarda Martech) para gestão de jobs de gravação em campo. Este repositório contém duas gerações do sistema:

| Geração | Pasta | Estado |
|---|---|---|
| **1.0 — MVP (Google Apps Script)** | [`apps-script/`](apps-script/) | Em operação; estabilização e segurança na Fase 0 (branch `claude/admiring-carson-mec94w`) |
| **2.0 — Plataforma (Supabase + Next.js/Vercel)** | [`web/`](web/) e [`supabase/`](supabase/) | Construída nesta branch conforme o *Documento de Escopo do Projeto* (29/09/2026); aguarda decisões da seção 14 e RIPD para o piloto com GPS |

O projeto é conduzido como **pesquisa aplicada (Design Science Research)** — ver [`docs/pesquisa/protocolo-de-pesquisa.md`](docs/pesquisa/protocolo-de-pesquisa.md).

---

## 2.0 — O que a plataforma faz

- **Acesso corporativo e perfis** (Fast, Analista, Supervisora, Admin) com permissão por linha (RLS). Nenhum endpoint público.
- **Agenda semanal** por Fast e slot; criação de job com **buffer de 2h, bloqueio de agendamento duplo e slot atômico** aplicados pelo banco (só a supervisora aprova, com motivo).
- **Briefing no app** (obrigatório antes do check-in), com referência visual e sinalização de 99.
- **PWA de campo**: jobs do dia, **check-in/check-out por geofence** (raio configurável, padrão 200 m), precisão mínima, justificativa obrigatória fora da geofence, **modo offline** com sincronização idempotente, comprovantes de 99 (ida/volta) e entrega de material.
- **Painel da supervisora**: kanban, **mapa do dia** (consulta auditada), alertas (briefing atrasado, check-in atrasado, fora da geofence, material 24h, comprovante faltando), exceções com decisão registrada, conciliação de 99 e bloqueio de "Concluído" sem comprovantes.
- **Indicadores/OKRs** da seção 3.2 calculados no banco (`analytics.indicadores_okr`) e views prontas para Power BI.
- **Privacidade por desenho**: localização só em eventos do job com o app aberto, termo de ciência versionado, retenção automática de 90 dias, log de quem consultou a posição de quem (visível ao próprio Fast).
- **Integrações por fila idempotente**: Notion (espelho), Google Calendar/Drive (Apps Script como serviço interno), WhatsApp Cloud API com e-mail de contingência.

## Estrutura

```
web/                 # Next.js 16 · React 19 · TypeScript · Tailwind 4 · MapLibre · PWA
supabase/migrations/ # Postgres 17 + PostGIS · RLS · triggers · pg_cron · analytics (6 migrações)
docs/
  pesquisa/          # protocolo DSR, evidências (smoke test)
  adr/               # decisões de arquitetura
  arquitetura.md     # componentes, modelo, segurança, operação, contrato do Apps Script, Power BI
  rastreabilidade.md # RF/RNF → implementação
  decisoes-pendentes.md
  processos-operacionais.md · fase0-checklist.md · forms-briefing-campos.md (MVP)
apps-script/         # MVP 1.0 (inalterado nesta branch)
.github/workflows/   # CI: gitleaks · lint · tipos · testes · build
```

## Rodar localmente (2.0)

```bash
cd web
cp .env.example .env.local   # preencher NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
pnpm install
pnpm dev
```

Testes das regras de negócio: `pnpm test`. Tipos: `pnpm typecheck`. Build: `pnpm build`.

## Infraestrutura

| Serviço | Identificação |
|---|---|
| Supabase | projeto `fast-midia-tools` (`wcidhqxkoltwfrlairqj`), região São Paulo (`sa-east-1`) |
| Vercel | projeto `fast-midia-tools` no time VanguardaOS, root `web/`, região `gru1`, cron do worker a cada 10 min |

Variáveis de ambiente: ver [`web/.env.example`](web/.env.example). Segredos nunca entram no Git (gitleaks no CI).

## Primeiro acesso

1. Abrir a URL do Vercel e entrar com a conta Google `@vanguardamartech.com.br` ou com e-mail e senha (convite em Cadastros → Acessos).
2. O primeiro usuário vira **Admin**. Em *Cadastros → Fasts*, cadastrar os Fasts com o e-mail do calendário (eles entram com esse e-mail, mesmo Gmail).
3. Em *Cadastros → Acessos*, convidar analistas e a supervisora.
4. Em *Cadastros → Configurações*, revisar buffer, raio, precisão e retenção.
5. Configurar no Vercel as credenciais das integrações conforme forem liberadas (Notion, WhatsApp, Apps Script, Resend).

## Documentação do MVP 1.0 (Apps Script)

Continua válida para o fluxo em operação: [`apps-script/instrucoes-deploy.md`](apps-script/instrucoes-deploy.md), [`docs/fase0-checklist.md`](docs/fase0-checklist.md), [`docs/forms-briefing-campos.md`](docs/forms-briefing-campos.md), [`docs/processos-operacionais.md`](docs/processos-operacionais.md). O README original do MVP está preservado em [`apps-script/README-mvp.md`](apps-script/README-mvp.md).
