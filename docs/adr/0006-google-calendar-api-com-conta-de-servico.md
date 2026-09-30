# ADR-0006 — Google Calendar pela API oficial com conta de serviço (Apps Script fica como alternativa)

**Status:** Aceito em 30/09/2026 (pedido da gerência do projeto: "integre o calendário do Google"). Complementa a decisão 7.1 do escopo, sem revogá-la.
**Contexto:** O escopo previa o Apps Script como serviço interno de Calendar/Drive (Fase 0), que continua sem endpoint publicado. A agenda precisa dos compromissos de cada Fast (RF-10) e cada job deve aparecer no calendário do Fast (RF-62). Esperar o Apps Script mantinha as duas funções inativas.

## Decisão

1. **Adaptador `google-calendar.ts`** fala direto com a Calendar API v3, autenticado por **conta de serviço** (JWT RS256 → token OAuth), sem bibliotecas externas. O worker da outbox usa esse adaptador para `calendar_upsert`/`calendar_delete` quando `GOOGLE_SERVICE_ACCOUNT_JSON` existe; caso contrário, cai no Apps Script como antes. `drive_verificar` continua no Apps Script.
2. **Dois modos de operação**, escolhidos por variável de ambiente:
   - **impersonar** (padrão): delegação em todo o domínio no Admin do Workspace; a conta de serviço age como o Fast (`sub` = e-mail do calendário) e grava no calendário principal dele. Bloqueios são lidos do calendário de cada Fast.
   - **compartilhado** (`GOOGLE_CALENDAR_ID`): um calendário corporativo compartilhado com a conta de serviço; o Fast entra como convidado (recebe o convite por e-mail). Bloqueios são lidos desse calendário, por convidado. Não exige o Admin do Workspace.
3. **Idempotência**: cada evento leva `extendedProperties.private.fmt_chave` (`job:<id>` ou `edicao:<id>`); o id retornado fica em `job.calendar_event_id` / `calendar_event_edicao_id`. Se o id se perder, o adaptador procura pela chave antes de criar outro.
4. **Bloqueios (RF-10)**: função pura `intervalosParaBloqueios` converte compromissos em `Fast × dia × slot` no fuso operacional (`FMT_TIMEZONE`, padrão America/Manaus), ignorando eventos criados pelo próprio app, eventos marcados como "livre" e recusados; eventos de dia inteiro bloqueiam os dois slots. Coberta por testes unitários.
5. **Degradação graciosa**: falha de credencial em um Fast não derruba a agenda (sem bloqueios para ele); a fila reprocessa com backoff (ADR-0004).

## Consequências

- Passa a existir uma credencial de longa duração (chave da conta de serviço) no Vercel: rotacionar a cada 90 dias e restringir a delegação ao escopo `calendar`.
- Em modo impersonar, o Admin do Workspace precisa autorizar o **ID de cliente** da conta de serviço com o escopo `https://www.googleapis.com/auth/calendar` (Admin Console → Segurança → Controles de API → Delegação em todo o domínio). Fasts com Gmail pessoal não são alcançados por impersonação: para eles, usar o modo compartilhado ou o convite por e-mail.
- Apps Script deixa de ser caminho crítico para o Calendar; permanece para verificação da pasta no Drive (RF-16) até haver decisão equivalente.

## Configuração (TI)

1. Google Cloud: criar projeto, ativar **Google Calendar API**, criar **conta de serviço** e uma chave JSON.
2. Modo impersonar: Admin Console → Delegação em todo o domínio → adicionar o ID de cliente da conta de serviço com o escopo `https://www.googleapis.com/auth/calendar`.
   Modo compartilhado: criar o calendário "Fast Mídia — Gravações", compartilhar com o e-mail da conta de serviço com permissão "Fazer alterações nos eventos" e copiar o ID do calendário.
3. Vercel → variáveis de ambiente: `GOOGLE_SERVICE_ACCOUNT_JSON` (conteúdo do JSON, pode ser base64), opcionalmente `GOOGLE_CALENDAR_ID`, `FMT_TIMEZONE`.
4. Validar em Cadastros → Integrações (status "configurada") e criar um job de teste: o evento aparece no calendário em até 10 minutos (cron do worker), e o compromisso do Fast aparece como "ocupado" na agenda.
