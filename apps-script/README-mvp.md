# Fast Mídia Tools — Automação de Agendamento

Sistema de automação para o setor Fast Mídia da Vanguarda Martech. Substitui o processo manual de agendamento por um fluxo integrado: agenda web → Notion → Google Drive → Google Calendar → WhatsApp.

---

## O que o sistema faz

1. **Supervisora abre a agenda web** e vê a disponibilidade de cada Fast na semana (dois slots por dia: 08:00–12:00 e 13:00–17:00), com base nos Google Calendários compartilhados
2. **Clica em um Fast disponível** e preenche o modal de agendamento (cliente, WhatsApp do analista, prazo, bloco de edição)
3. O sistema automaticamente:
   - Cria a **página do job no Notion** com status "Aguardando briefing"
   - Verifica e cria **subpastas no Google Drive** do cliente
   - Bloqueia o **Google Calendar** do Fast com o evento do job
   - Envia **WhatsApp para o analista** com o link do briefing e pasta de ingest
   - Envia **WhatsApp para o Fast** com os dados do job

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend + Frontend | Google Apps Script (GAS) |
| Agenda web | HTML/CSS/JS dentro do GAS (`agenda-index.html`) |
| Banco de dados de jobs | Notion API |
| Armazenamento de materiais | Google Drive |
| Calendários dos Fasts | Google Calendar API |
| Notificações | WhatsApp Cloud API (Meta) |
| Briefing | Google Forms |
| Deploy/CI | clasp CLI |

---

## Pré-requisitos

- Conta Google com acesso aos calendários dos Fasts compartilhados
- Workspace Notion com banco de dados de jobs configurado
- App na Meta Business Suite com WhatsApp Cloud API (ver seção WhatsApp)
- [Node.js](https://nodejs.org) instalado (para o clasp)
- clasp instalado globalmente: `npm install -g @google/clasp`

---

## Configuração inicial

### 1. Clonar o repositório

```bash
git clone https://github.com/savimesmo/Fast-Midia-Tools.git
cd Fast-Midia-Tools/apps-script
```

### 2. Criar o `config.gs`

Copie o template e preencha todos os valores:

```bash
cp config.exemplo.gs config.gs
```

Edite `config.gs` com seus dados reais. Nunca commite este arquivo — ele já está no `.gitignore`.

### 3. Autenticar o clasp

```bash
clasp login
```

Vai abrir o navegador para autorizar com a conta Google que vai rodar o script. Use a mesma conta que tem acesso aos calendários dos Fasts.

### 4. Criar ou vincular o projeto GAS

**Projeto novo:**
```bash
clasp create --title "Fast Midia - Agendamento" --type webapp
```

**Vincular a um projeto existente:** edite `.clasp.json` manualmente com o `scriptId` do projeto existente.

### 5. Subir o código

```bash
clasp push --force
```

### 6. Fazer o deploy

```bash
clasp deploy --description "v1.0"
```

A URL gerada é a do web app. Compartilhe com a equipe.

---

## Referência do `config.gs`

```javascript
const CONFIG = {
  NOTION_TOKEN: 'ntn_...',          // Token da integração interna do Notion
  NOTION_DATABASE_ID: '...',         // ID do banco de jobs (da URL do Notion)

  DRIVE_CRIACAO_FOLDER_ID: '...',    // ID da pasta raiz no Drive (da URL)

  FORMS_ID: '...',                   // ID do Google Forms de briefing
  FORMS_ENTRY_JOB_ID: 'entry.XXXXX', // Campo "ID do Job" no Forms

  WHATSAPP_PHONE_NUMBER_ID: '...',   // ID do número no Meta Business
  WHATSAPP_ACCESS_TOKEN: 'EAAN...', // Token de sistema permanente (não o de teste)

  EMAIL_SUPERVISORA: '...',          // Recebe alertas quando WhatsApp falha

  FASTS: {
    'Nome do Fast': {
      email: '...@empresa.com.br',   // E-mail do Google Calendar do Fast
      phone: '5592999999999',        // DDI + DDD + número (sem espaços ou +)
      cor: '#7C3AED',                // Cor exibida na agenda web
    },
    // ... demais Fasts
  },

  SLOTS: [
    { label: '08:00 – 12:00', inicio: 8,  fim: 12 },
    { label: '13:00 – 17:00', inicio: 13, fim: 17 },
  ],

  TIMEZONE: 'America/Sao_Paulo',
};
```

**Como obter cada valor:**

| Campo | Onde encontrar |
|---|---|
| `NOTION_TOKEN` | notion.so → Configurações → Conexões → Criar integração interna → copiar token `ntn_...` |
| `NOTION_DATABASE_ID` | URL do banco no Notion: `notion.so/WORKSPACE/DATABASE_ID?v=...` |
| `DRIVE_CRIACAO_FOLDER_ID` | URL da pasta no Drive: `drive.google.com/drive/folders/ID_AQUI` |
| `FORMS_ID` | URL do Forms: `docs.google.com/forms/d/FORMS_ID/edit` |
| `FORMS_ENTRY_JOB_ID` | Pré-visualize o Forms → inspecione o campo "ID do Job" → atributo `name` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developers → app → WhatsApp → Etapa 2 → número registrado |
| `WHATSAPP_ACCESS_TOKEN` | Meta Business Manager → Usuários do sistema → gerar token permanente (ver seção WhatsApp) |

---

## WhatsApp — Situação e opções

> Esta seção é importante. Leia com atenção antes de tentar configurar o WhatsApp.

### Como funciona a API

O sistema usa a **WhatsApp Cloud API** da Meta para enviar duas mensagens a cada agendamento:
- **Para o analista/account:** link do briefing, dados do job, pasta de ingest
- **Para o Fast:** confirmação do job, prazo e pasta para subir o material

### Modo sandbox (teste) vs. produção

A Meta oferece um **número de teste gratuito** (`+1 555 149-5777`) para desenvolver e testar. Mas tem uma limitação crítica:

> **No sandbox, mensagens só chegam para números que foram explicitamente verificados como "destinatários de teste" no painel do Meta.** A API retorna HTTP 200 (sucesso), mas a mensagem é silenciosamente descartada se o destinatário não estiver na lista.

Isso significa que **o sandbox não serve para uso em produção** — você precisaria verificar manualmente cada número de analista e Fast antes de eles receberem qualquer mensagem.

### Por que não usar o número do WhatsApp Business existente

O mesmo número **não pode estar simultaneamente** no WhatsApp Business app (celular) e na Cloud API. Registrar o número na API desconecta o app do celular.

### Solução recomendada: número dedicado

Comprar um chip/número exclusivo para o bot de notificações. Vantagens:
- Mantém o WhatsApp Business do celular intacto
- Token permanente, sem expiração
- Envia para qualquer número sem restrição

**Como configurar quando tiver o número:**

1. Acesse [developers.facebook.com](https://developers.facebook.com) → seu app → Casos de uso → Conectar no WhatsApp
2. **Etapa 2. Configuração da produção** → "Registre seu número de telefone do WhatsApp"
3. Informe o novo número → verifique via SMS
4. Após registrado, copie o **Phone Number ID** gerado
5. Gere um **token de sistema permanente:**
   - Meta Business Manager → Configurações → Usuários do sistema
   - Adicionar usuário do sistema → Gerar token → selecione o app → permissão `whatsapp_business_messaging`
   - Copie o token (não expira, guarde em lugar seguro)
6. Atualize `config.gs` com os novos valores e faça novo deploy:
```bash
clasp push --force
clasp deploy --description "token WA producao"
```

### Estado atual do projeto

| Item | Status |
|---|---|
| App Meta criado | ✅ |
| Etapa 1 (sandbox) | ✅ Concluída |
| Número dedicado | ⏳ Aguardando compra do chip |
| Etapa 2 (número de produção) | ⏳ Fazer após ter o número |
| Token permanente | ⏳ Fazer após Etapa 2 |

Enquanto o número não chega, o sistema funciona normalmente — exceto que as mensagens WhatsApp não são enviadas. Se a chamada à API falhar, o sistema registra o erro no log e envia um e-mail de fallback para a supervisora.

---

## Triggers automáticos

Após o deploy, configure os triggers no editor do Apps Script (ícone de relógio ⏱ → + Adicionar trigger):

| Função | Tipo | Horário |
|---|---|---|
| `waKeepAlive` | Diário | 08:30–09:00 |
| `validarComprovantes99` | Diário | 08:00–09:00 |

> **Alternativa para `waKeepAlive`:** pedir que cada Fast mande "bom dia" por WhatsApp todos os dias. Isso abre a janela de serviço de 24h sem custo de template e dispensa o trigger.

O trigger `onFormSubmit` do briefing fica no **projeto do Google Forms** (não aqui). Veja `docs/instrucoes-deploy.md` para o passo a passo.

---

## Atualizar código após mudanças

```bash
clasp push --force
clasp deploy --description "descrição da mudança"
```

**Importante:** sempre crie um novo deploy (`clasp deploy` sem `--deploymentId`). Atualizar um deploy existente causa cache e a versão nova pode não aparecer.

---

## Estrutura de arquivos

```
apps-script/
├── agenda-index.html      # Frontend da agenda web (HTML/CSS/JS)
├── agenda-webapp.gs       # doGet(), getConfigPublica(), getDisponibilidade(), criarAgendamento()
├── agendamento.gs         # processarNovoAgendamento_() — orquestra Notion + Drive + WA
├── briefing.gs            # onFormSubmit — atualiza Notion quando briefing é preenchido
├── calendario.gs          # getDisponibilidadeSemana() — lê Google Calendários dos Fasts
├── comprovante99.gs       # validarComprovantes99() — verifica comprovantes diariamente
├── config.exemplo.gs      # Template de configuração (commitar este)
├── config.gs              # Configuração real com tokens (NÃO commitar — gitignored)
├── criar-forms.gs         # Helpers para criar o Google Forms programaticamente
├── drive.gs               # buscarPastaCliente(), resolverPastaPorId()
├── notion.gs              # notionCreatePage(), notionUpdatePage(), helpers de propriedades
└── whatsapp.gs            # waSendText(), waSendTemplate(), waKeepAlive(), testarWhatsApp()
```

---

## Documentação adicional

- [`docs/instrucoes-deploy.md`](docs/instrucoes-deploy.md) — passo a passo completo de setup
- [`docs/fase0-checklist.md`](docs/fase0-checklist.md) — checklist de pré-requisitos
- [`docs/forms-briefing-campos.md`](docs/forms-briefing-campos.md) — campos do Google Forms de briefing
- [`docs/processos-operacionais.md`](docs/processos-operacionais.md) — processos da equipe Fast Mídia

---

## Diagnóstico rápido

**Grid da agenda aparece vazio / sem linhas:**
- Verifique se os calendários dos Fasts estão compartilhados com a conta que faz o deploy
- Abra o editor GAS → Execuções → veja se `getDisponibilidadeSemana` lançou erro

**WhatsApp não chega:**
- Rode `testarWhatsApp()` no editor GAS — o log mostra o erro exato
- Erros comuns: `401` = token expirado; `131030` = número não está na lista de teste (sandbox); `400` = formato de número inválido (use DDI+DDD+número, sem `+` ou espaços)

**Página não abre (erro de autorização):**
- Confirme que `access` no `appsscript.json` está como `ANYONE` (conta Gmail) ou `DOMAIN` (conta Workspace do mesmo domínio)
- Crie um novo deploy após qualquer mudança no `appsscript.json`
