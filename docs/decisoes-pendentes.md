# Decisões pendentes (seção 14 do escopo) — registro de estado

Este registro mostra o que a plataforma já assume e o que continua aguardando a diretoria/TI/DPO. Decisões exercidas pela gerência do projeto durante a implementação ficam marcadas como **Exercida** com a ADR correspondente.

| # | Decisão | Recomendação do escopo | Estado em 30/09/2026 | O que a plataforma faz hoje |
|---|---|---|---|---|
| 1 | Escopo do GPS | Check-in/out agora; rastreio na janela só após piloto e RIPD | **Exercida em 30/09/2026 pela gerência do projeto (mudança de escopo, ADR-0005)**: posição do Fast em tempo real entre check-in e check-out. RIPD v1.0 elaborado e aprovado internamente (`docs/lgpd/ripd-fast-midia-tools.md`); a empresa não possui DPO e a gerência dispensou ciência formal da diretoria. | Check-in/out/corrida por evento (ADR-0003) + posição a cada 30 s só durante a gravação, com o app aberto, indicador, pausa, retenção de 7 dias e termo 2.0 (ADR-0005). Desligável em `configuracao.rastreio_habilitado`. |
| 2 | Sistema de registro | Banco próprio com PostGIS; Notion como espelho | **Exercida** pela gerência do projeto ao solicitar Supabase | Supabase é a fonte; Notion recebe espelho por fila (ADR-0001). Reversível: migrações versionadas. |
| 3 | Conta Google | Workspace corporativo (SSO, `access: DOMAIN`) | **Parcial (30/09): login pelo Supabase Auth com e-mail e senha**, primeiro acesso por link de convite gerado em Cadastros → Acessos. Google OAuth desativado (`NEXT_PUBLIC_AUTH_GOOGLE=false`) até a TI concluir o cliente OAuth com o callback do Supabase. Conta Google do Apps Script segue pendente. | Convite cria a conta já com o perfil; senha definida em Minha conta; "esqueci a senha" = novo link pela supervisão. |
| 4 | Aparelho do Fast | Corporativo ou pessoal (BYOD) | **Exercida em 30/09/2026 pela gerência do projeto**: BYOD com política própria (`docs/lgpd/politica-byod.md`), alternativa corporativa sob demanda [VALIDAR] | PWA funciona em qualquer aparelho; termo 2.0 e política BYOD descrevem permissões, consumo e direito de recusa. |
| 5 | Ferramenta de agendamento externa | Confirmar se a agenda própria substitui Linktree/Calendly | **Pendente (supervisora, semana 1)** | Agenda própria em `/agenda`; webhooks externos não implementados (RF-63, prio. C). |
| 6 | Produto interno ou replicável | Interno agora; multiempresa só se aprovado | **Pendente (diretoria, semana 4)** | Modelo single-tenant. Estrutura permite evoluir (ADR futuro). |
| 7 | Prazo de retenção da localização | 90 dias (a validar) | **Adotada provisoriamente no RIPD v1.0** (90 dias eventos; 7 dias posições); revisão ao fim do piloto (ação A4 do RIPD) | `configuracao.retencao_localizacao_dias = 90` e `retencao_rastreio_dias = 7`, alteráveis pelo Admin com auditoria. |

## Itens que dependem de terceiros para ativar integrações

| Item | Responsável | Efeito enquanto pendente |
|---|---|---|
| Chip dedicado do WhatsApp + token permanente | Breno / TI | Fila acumula `whatsapp_send` em erro; contingência por e-mail quando `RESEND_API_KEY` existir |
| Token da integração Notion + ID da database | Admin do Notion | `notion_upsert` pendente; o app opera normalmente |
| Conta de serviço do Google + delegação em todo o domínio (ou calendário compartilhado) — ADR-0006 | TI (Admin do Workspace) | Calendar não sincroniza; agenda usa só a ocupação do banco. Variáveis: `GOOGLE_SERVICE_ACCOUNT_JSON`, opcional `GOOGLE_CALENDAR_ID` |
| Endpoint do Apps Script com token (Fase 0, branch `claude/admiring-carson-mec94w`) | TI/Dev | Só a verificação da pasta no Drive fica pendente (Calendar passou para a API oficial, ADR-0006) |
| Credenciais OAuth do Google (Supabase Auth) | TI | Login por magic link/senha |
| Designação de encarregado (art. 41 LGPD) | Gerência / Diretoria | RIPD v1.0 aprovado internamente libera o piloto (M3); encarregado a designar até 21/10 (ação A3 do RIPD) |
