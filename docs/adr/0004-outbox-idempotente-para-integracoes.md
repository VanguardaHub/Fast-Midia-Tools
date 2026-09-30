# ADR-0004 — Outbox idempotente para Notion, Calendar/Drive (Apps Script), WhatsApp e e-mail

**Status:** Aceito
**Contexto:** RNF-07 (degradação graciosa) e RNF-08 (sincronização idempotente com fila e nova tentativa). O chip do WhatsApp ainda não existe (premissa 4); o Notion e o Apps Script têm limites de taxa.
**Decisão:** Triggers do banco gravam itens em `fila_integracao` com `chave_idempotencia` única (ex.: `notion:job:<id>`, `wa:novo-job:<id>`). Um worker (`/api/integracoes/processar`, cron do Vercel a cada 10 min, protegido por `CRON_SECRET`, usando `service_role`) processa com claim otimista, backoff exponencial e no máximo 5 tentativas; depois marca `descartado` e exibe em Cadastros → Integrações. O Apps Script permanece como serviço interno de Calendar e Drive (contrato em `docs/arquitetura.md`), publicado com `access: DOMAIN` e token.
**Consequências:** A operação principal (agenda, briefing, check-in, comprovantes) nunca depende de serviço externo; a entrega das notificações é eventual (≤ 10 min). Credenciais só no Vercel.
