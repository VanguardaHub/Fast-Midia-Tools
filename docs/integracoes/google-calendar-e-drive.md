# Integrações Google — Calendar (espelho) e Drive (pasta de ingest)

**Versão:** 2.0 · **Data:** 08/10/2026 · Substitui a documentação "Integração Google Apps Script" (GAS) de 30/09. Decisão registrada na revisão da ADR-0006.

## 1. Resumo

| Função | Caminho principal | Alternativa | Estado |
|---|---|---|---|
| Job → evento no calendário do Fast (RF-62) | Google Calendar API com conta de serviço (`google-calendar.ts`) | Apps Script `calendar_upsert`/`calendar_delete` | código pronto; **opcional**; aguarda credencial |
| Pasta de ingest no Drive do cliente (RF-16) | Google Drive API com a mesma conta de serviço (`google-drive.ts`) | Apps Script `drive_verificar` | código pronto; aguarda credencial e `pasta_drive_id` dos clientes |
| Leitura de compromissos do Fast (bloqueios na agenda) | **retirada do escopo** em 08/10 | — | substituída por "Minha disponibilidade" no app |

Sem credencial, nada quebra: a fila acumula `calendar_*` e `drive_verificar` em erro com nova tentativa, e o WhatsApp de novo job sai após 3 tentativas avisando que a pasta ainda não foi criada.

## 2. Por que a API oficial e não o Apps Script

O Apps Script exigia um endpoint publicado numa conta Google (`access: DOMAIN`), código mantido fora do repositório e uma conta pessoal como executora (protótipo em `dog.smf@gmail.com`). A conta de serviço é credencial corporativa, auditável, rotacionável, e o código fica no mesmo repositório, com testes. O contrato do Apps Script continua suportado como alternativa (`apps-script.ts`), sem a ação `disponibilidade`.

## 3a. Caminho adotado em 08/10/2026 — conta Google corporativa conectada (OAuth)

Decisão da gerência: as integrações agem como a conta **diana.savi@vanguardamartech.com.br**, sem conta de serviço nem Admin do Workspace.

1. **Google Cloud → Credenciais → cliente OAuth "Aplicativo da Web"** (já existe: `38179161838-…apps.googleusercontent.com`): adicionar o URI de redirecionamento autorizado `https://fast-midia-tools.vercel.app/api/google/callback`. Na tela de consentimento, incluir a conta como usuária de teste se o app estiver em modo "Testing" (ou publicar para o domínio interno).
2. Vercel: `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET` (configurados em 08/10).
3. Logada como Admin, a Diana abre **Cadastros → Integrações → Conectar conta Google**, autoriza Calendar e Drive (acesso offline). O token de atualização fica em `integracao_credencial`, legível só pelo service_role.
4. Pré-requisito de acesso: a conta conectada precisa ser **Editora** das pastas dos clientes no Drive (ou membro do Drive compartilhado) e ter calendário próprio. Os eventos de gravação são criados no calendário dela com o Fast como convidado; o Fast recebe no calendário dele.
5. Desconectar: botão na mesma tela; para revogar de vez, também em myaccount.google.com/permissions.

Prioridade: conta conectada > conta de serviço (seção 3) > Apps Script.

## 3. Configuração alternativa — conta de serviço (TI)

1. **Google Cloud:** criar projeto, ativar **Google Calendar API** e **Google Drive API**, criar **conta de serviço** e baixar a chave JSON.
2. **Workspace Admin → Segurança → Controles de API → Delegação em todo o domínio:** adicionar o ID de cliente da conta de serviço com os escopos `https://www.googleapis.com/auth/calendar` e `https://www.googleapis.com/auth/drive`.
   Sem delegação: compartilhar o calendário corporativo (`GOOGLE_CALENDAR_ID`) e as pastas dos clientes com o e-mail da conta de serviço como Editor.
3. **Vercel → variáveis de ambiente:**

| Variável | Uso |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | conteúdo do JSON da chave (inteiro ou base64) — liga Calendar e Drive |
| `GOOGLE_DRIVE_IMPERSONAR` | e-mail de um usuário do Workspace com acesso ao Drive compartilhado `[VG] Fast Media` (modo delegação) |
| `GOOGLE_CALENDAR_ID` | opcional: calendário compartilhado em vez do calendário pessoal do Fast |
| `DRIVE_ESTRUTURA` | opcional: JSON da estrutura de pastas (padrão abaixo) |
| `FMT_TIMEZONE` | fuso operacional (padrão `America/Manaus`) |

4. **Cadastros → Clientes:** preencher **ID da pasta no Drive** de cada cliente ativo (o que vem depois de `/folders/` na URL da pasta raiz do cliente). Sem o ID, a integração não tem ponto de partida: o Drive não é pesquisado por nome.
5. Conferir em **Cadastros → Integrações**: "Google Calendar" e "Google Drive" como "configurada".

## 4. Drive — estrutura garantida por job

```
pasta do cliente (ID cadastrado)
└── !INSTITUCIONAL
    ├── BANCO DE IMAGENS
    │   └── MM NOME        ex.: "10 OUTUBRO"
    │       └── DD-MM      ex.: "15-10"   ← pasta de ingest (URL salva em job.pasta_ingest_url)
    └── VÍDEOS
        └── MM NOME
            └── DD-MM
```

- Idempotente: cada nível é procurado pelo nome dentro da pasta-mãe; só cria o que falta. Reprocessar não duplica.
- Erros orientam a correção: "pasta do cliente não encontrada" (ID errado), "sem permissão" (compartilhar com a conta de serviço ou configurar `GOOGLE_DRIVE_IMPERSONAR`), "cliente sem ID" (descartado; cadastrar e reprocessar).
- O WhatsApp de novo job espera a pasta existir (até 3 tentativas da fila) para mandar o link certo ao Fast e ao analista.

## 5. Calendar — espelho opcional do job

- Evento "🎬 Gravação · Cliente (Job #N)" no calendário do Fast com local, roteiro, aviso de 99, prazo do material e link do app; evento de dia inteiro "✂️ Edição" quando houver bloco de edição.
- Idempotente por `extendedProperties.private.fmt_chave`; cancelamento remove os dois eventos.
- Não lê nada do calendário do Fast.

## 6. Fluxo de um novo job

1. Supervisora/analista cria o job na Agenda (geofence definida pelo endereço).
2. Fila: `drive_verificar` → pasta de ingest criada → `calendar_upsert` → evento no calendário → `whatsapp_send` com os links.
3. Fast recebe o WhatsApp (quando o chip existir) e vê o job em "Hoje"; sobe o material na pasta de ingest.

## 7. Erros comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `drive_verificar` descartado: "cliente sem ID" | `pasta_drive_id` vazio | Cadastrar o ID em Cadastros → Clientes e reprocessar na fila |
| "Sem permissão na pasta" | conta de serviço sem acesso | Compartilhar como Editor ou configurar `GOOGLE_DRIVE_IMPERSONAR` com usuário que tem acesso |
| `Google OAuth: unauthorized_client` | delegação em todo o domínio não autorizada para o escopo | Adicionar o ID de cliente com os escopos de Calendar e Drive no Admin Console |
| Evento não aparece no calendário do Fast | e-mail do Fast fora do Workspace (Gmail pessoal) | Usar `GOOGLE_CALENDAR_ID` (calendário compartilhado; Fast entra como convidado) |

## 8. Pendências para ativar

- [ ] Conta de serviço criada com as duas APIs ativadas
- [ ] Delegação em todo o domínio (ou compartilhamentos manuais)
- [ ] Variáveis no Vercel e redeploy
- [ ] `pasta_drive_id` de cada cliente ativo
- [ ] Teste ponta a ponta: criar job → pasta no Drive → evento no Calendar → WhatsApp com os links
