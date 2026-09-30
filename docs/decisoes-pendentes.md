# Decisões pendentes (seção 14 do escopo) — registro de estado

Nenhuma decisão foi alterada pela implementação. Este registro mostra o que a plataforma já assume e o que continua aguardando a diretoria/TI/DPO.

| # | Decisão | Recomendação do escopo | Estado em 30/09/2026 | O que a plataforma faz hoje |
|---|---|---|---|---|
| 1 | Escopo do GPS | Check-in/out agora; rastreio na janela só após piloto e RIPD | **Pendente (diretoria, kick-off)** | Implementado apenas check-in/out/corrida por evento (ADR-0003). Nada de rastreio contínuo. |
| 2 | Sistema de registro | Banco próprio com PostGIS; Notion como espelho | **Exercida** pela gerência do projeto ao solicitar Supabase | Supabase é a fonte; Notion recebe espelho por fila (ADR-0001). Reversível: migrações versionadas. |
| 3 | Conta Google | Workspace corporativo (SSO, `access: DOMAIN`) | **Parcial (30/09): login pelo Supabase Auth com e-mail e senha**, primeiro acesso por link de convite gerado em Cadastros → Acessos. Google OAuth desativado (`NEXT_PUBLIC_AUTH_GOOGLE=false`) até a TI concluir o cliente OAuth com o callback do Supabase. Conta Google do Apps Script segue pendente. | Convite cria a conta já com o perfil; senha definida em Minha conta; "esqueci a senha" = novo link pela supervisão. |
| 4 | Aparelho do Fast | Corporativo ou pessoal (BYOD) | **Pendente (RH + diretoria, semana 2)** | PWA funciona em qualquer aparelho; termo de ciência menciona permissões do celular. Política BYOD a redigir. |
| 5 | Ferramenta de agendamento externa | Confirmar se a agenda própria substitui Linktree/Calendly | **Pendente (supervisora, semana 1)** | Agenda própria em `/agenda`; webhooks externos não implementados (RF-63, prio. C). |
| 6 | Produto interno ou replicável | Interno agora; multiempresa só se aprovado | **Pendente (diretoria, semana 4)** | Modelo single-tenant. Estrutura permite evoluir (ADR futuro). |
| 7 | Prazo de retenção da localização | 90 dias (a validar) | **Pendente (DPO, semana 4)** | `configuracao.retencao_localizacao_dias = 90`, alterável pelo Admin com auditoria. |

## Itens que dependem de terceiros para ativar integrações

| Item | Responsável | Efeito enquanto pendente |
|---|---|---|
| Chip dedicado do WhatsApp + token permanente | Breno / TI | Fila acumula `whatsapp_send` em erro; contingência por e-mail quando `RESEND_API_KEY` existir |
| Token da integração Notion + ID da database | Admin do Notion | `notion_upsert` pendente; o app opera normalmente |
| Endpoint do Apps Script com token (Fase 0, branch `claude/admiring-carson-mec94w`) | TI/Dev | Calendar/Drive não sincronizam; agenda usa ocupação do banco |
| Credenciais OAuth do Google (Supabase Auth) | TI | Login por magic link/senha |
| RIPD aprovado | DPO | Piloto com GPS não inicia (M3) |
