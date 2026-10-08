# Matriz de Rastreabilidade — Requisitos × Implementação

Legenda de situação: ✅ implementado · 🟡 parcial / depende de credencial ou decisão · ⏳ fase posterior · 🔵 fora da branch (Fase 0 no Apps Script).

## Requisitos funcionais

| ID | Requisito | Prio. | Onde está | Situação |
|---|---|---|---|---|
| RF-01 | Login corporativo e sessão com expiração | M | Supabase Auth (magic link, senha, Google OAuth preparado); trigger `tg_auth_usuario_validar` (domínio/convite); `proxy.ts` | ✅ (Google OAuth aguarda decisão 3) |
| RF-02 | Perfis Fast/Analista/Supervisora/Admin com RLS | M | `perfil`, políticas em 0004/0006, `auth_perfil()` | ✅ |
| RF-03 | Cadastro de Fasts por interface | M | `/cadastros/fasts` (criar, editar, vincular conta, desativar, excluir sem jobs), `/cadastros/clientes`, `/cadastros/acessos` (nome, telefone, perfil, status) | ✅ |
| RF-10 | Grade semanal por Fast e slot (reinterpretado em 08/10: lida do sistema, não do Calendar) | M | `/agenda` (ocupação do banco) + `indisponibilidade` informada pelo Fast (`MinhaDisponibilidade`, triggers P0014/P0015, migração 0014) | ✅ |
| RF-11 | Criar job com cliente, Fast, data, slot, analista, prazo, bloco de edição | M | `/agenda` → `criarJob` | ✅ |
| RF-12 | Bloquear < 2h de folga e sinalizar à supervisora | M | `tg_job_validar` (P0003), `detectarConflitos()` no cliente, exceção registrada | ✅ |
| RF-13 | Impedir agendamento duplo sem aprovação | M | `tg_job_validar` (P0002), `excecao_motivo` só para gestão | ✅ |
| RF-14 | Bloqueio atômico do slot | M | índice único parcial `job_slot_unico` + exclusão GiST `job_sem_sobreposicao` | ✅ |
| RF-15 | Cancelar e reagendar, liberando calendário e notificando | M | `cancelar_job`, `atualizarJob`; fila `calendar_delete`/`calendar_upsert`/`whatsapp_send` | ✅ (entrega depende de credenciais) |
| RF-16 | Verificar/criar pasta do cliente no Drive | M | fila `drive_verificar` → Drive API (`google-drive.ts`, estrutura `drive-estrutura.ts` testada; Apps Script alternativo); `cliente.pasta_drive_id` obrigatório | ✅ código; 🟡 aguarda conta de serviço e IDs das pastas |
| RF-20 | Briefing dentro do app | M | `/jobs/[id]` (BriefingForm), tabela `briefing`, bucket `referencias-briefing` | ✅ |
| RF-21 | Impedir check-in sem briefing | M | `tg_evento_localizacao_validar` (P0007) | ✅ |
| RF-22 | Alerta de briefing não recebido até D−1 | S | `gerar_alertas_periodicos()` → `briefing_atrasado` | ✅ |
| RF-30 | Lista de jobs do dia com endereço, briefing e link de ingest | M | `/campo` | ✅ |
| RF-31 | Check-in com lat/long, precisão e horário vs geofence | M | `registrar_evento_localizacao`, `CheckinPanel` | ✅ |
| RF-32 | Check-out com duração real | M | `tg_evento_localizacao_pos` → `job.duracao_real_min` | ✅ |
| RF-33 | Raio configurável por job (padrão 200 m) | M | `job.raio_geofence_m`, `configuracao.raio_geofence_padrao_m`, `PontoGeofence` | ✅ |
| RF-34 | Fora da geofence/baixa precisão exige justificativa e alerta | M | P0010/P0011; alertas `checkin_fora_geofence`, `checkin_baixa_precisao`; exceção pendente | ✅ |
| RF-35 | Captura só com app aberto e na janela, com indicador | M | `capturarLocalizacao()` pontual; P0006 (janela); indicador no `CheckinPanel` | ✅ |
| RF-36 | Geocodificação com confirmação manual no mapa | M | `/api/geocodificar` (Nominatim/Google), `PontoGeofence`, `definir_ponto_job`, `ponto_confirmado` | ✅ |
| RF-37 | Registro offline com sincronização | S | `lib/offline.ts` (IndexedDB), `SincronizarOffline`, chave idempotente, service worker | ✅ básico |
| RF-38 | Rastreio contínuo na janela do job | C → implementado (decisão 1 exercida, ADR-0005) | tipo `posicao`, `RastreioJanela`, `lib/rastreio.ts`, P0012/P0013, `rastreio_*` em `configuracao`, termo 2.0 | ✅ só entre chegada e saída, app aberto; RIPD a revisar |
| RF-40 | Solicitação de 99 marcada no briefing | M | `briefing.precisa_99` → `job.precisa_99` | ✅ |
| RF-41 | Upload de comprovantes de ida/volta e valores pelo app | M | `Comprovantes99`, `PreviewComprovante` (miniatura/PDF por URL assinada), bucket `comprovantes-99`, `corrida_99` | ✅ |
| RF-42 | Bloqueio preventivo de "Concluído" sem os dois comprovantes | M | `tg_job_validar` (P0004) | ✅ |
| RF-43 | Comparação destino × geofence com alerta | S | `tg_corrida_99_validar` (`divergencia_destino`), alerta `destino_divergente` | ✅ (destino_ponto quando informado) |
| RF-44 | Gasto de 99 por Fast e por dia | M | `analytics.vw_gasto_99`, `vw_gasto_99_por_fast_dia`, `/indicadores` | ✅ |
| RF-50 | Kanban por status | M | `/jobs` (Kanban) | ✅ |
| RF-51 | Mapa do dia com último check-in | M | `/mapa`, RPC `mapa_do_dia` (auditada) | ✅ |
| RF-52 | Alertas: atraso, fora da geofence, material 24h, comprovante | M | `gerar_alertas_periodicos()` + triggers; `/alertas` | ✅ |
| RF-53 | Ajustar Fast e aprovar exceções com motivo | M | `AcoesJob`, `ExcecoesJob`, `decidir_excecao`, exceção `troca_fast` | ✅ |
| RF-54 | Exportar para Power BI | S | schema `analytics` (views com `security_invoker`); instruções em `docs/arquitetura.md` | ✅ |
| RF-60 | Notificar analista e Fast (WhatsApp, fallback push/e-mail) | M | fila `whatsapp_send`/`email_send`, `lib/integracoes` | 🟡 aguarda chip/credenciais |
| RF-61 | Espelhar job no Notion | M | fila `notion_upsert`, `lib/integracoes/notion.ts` | 🟡 aguarda token |
| RF-62 | Criar/atualizar eventos no Calendar do Fast | M | fila `calendar_upsert`/`calendar_delete` → Calendar API (conta de serviço, idempotente por `fmt_chave`; evento de edição em dia inteiro); Apps Script como alternativa | ✅ código; 🟡 aguarda conta de serviço (ADR-0006) |
| RF-63 | Webhook autenticado para agendadores externos | C | `/api/integracoes/processar` com `CRON_SECRET` (padrão de assinatura) | ⏳ |

## Requisitos não funcionais

| ID | Requisito | Onde está | Situação |
|---|---|---|---|
| RNF-01 | Todo endpoint autenticado; RLS em todas as tabelas | `proxy.ts`; 0004/0006; advisors sem crítico | ✅ |
| RNF-02 | Segredos fora do Git; varredura no CI | `.env.example`, `.gitignore`, gitleaks no CI | ✅ |
| RNF-03 | HTTPS; localização criptografada em repouso; menor privilégio | Vercel/Supabase (TLS + criptografia em repouso); `Permissions-Policy`; RPCs restritas | ✅ |
| RNF-04 | Retenção 90 dias + log de consulta de posição | `expurgar_eventos_localizacao` (pg_cron), `mapa_do_dia`/`consultar_localizacoes_job` auditadas; `/conta` mostra ao Fast | ✅ |
| RNF-05 | Lista do dia ≤ 3 s em 4G; check-in ≤ 5 s | Server Components, consultas indexadas; teste de campo pendente | 🟡 medir no piloto |
| RNF-06 | Precisão ≤ 100 m; acima, justificativa | `configuracao.precisao_maxima_m`, P0010 | ✅ |
| RNF-07 | 99,5% em horário comercial; degradação graciosa | Vercel + Supabase gerenciados; fila com retry | ✅ (monitoramento a configurar) |
| RNF-08 | Sincronização idempotente com fila e retry | `fila_integracao`, `enfileirar_integracao`, worker com backoff | ✅ |
| RNF-09 | PWA instalável, toque grande, pt-BR, uma mão | manifest, `globals.css` (min-h-12), navegação inferior | ✅ |
| RNF-10 | Android/iOS recentes; offline básico | service worker, fila IndexedDB; matriz de dispositivos no piloto | 🟡 testar |
| RNF-11 | Código versionado, PR, testes, ambientes | CI (lint, tipos, testes, build), `regras.test.ts` (21 testes) | ✅ |
| RNF-12 | Trilha de auditoria | `auditoria` + triggers `auditar()` | ✅ |
| RNF-13 | Conta de serviço corporativa; documentação de operação | `docs/arquitetura.md`; conta Google depende da decisão 3 | 🟡 |

## Lacunas do diagnóstico (seção 2.2)

| # | Lacuna | Tratamento |
|---|---|---|
| 1 | Acesso público / sem identidade | Auth + RLS + proxy (2.0); `access: DOMAIN` no Apps Script (🔵 Fase 0) |
| 2 | Segredos no código | Variáveis de ambiente + gitleaks (2.0); PropertiesService (🔵 Fase 0) |
| 3 | Regras não aplicadas | Triggers/constraints (2.0); LockService (🔵 Fase 0) |
| 4 | Sem prova de presença | Check-in/out por geofence |
| 5 | Controle do 99 retroativo | Bloqueio preventivo (P0004) |
| 6 | Bugs / lista fixa de Fasts | Cadastro em `fast` (2.0); `waKeepAlive` (🔵 Fase 0) |
| 7 | WhatsApp em sandbox | Fila com contingência por e-mail; chip pendente |
| 8 | Sem testes/CI/ambientes/auditoria | CI, Vitest, auditoria, ambientes |
