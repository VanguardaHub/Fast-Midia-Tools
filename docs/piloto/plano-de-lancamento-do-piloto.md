# Plano de Lançamento do Piloto — Fast Mídia Tools 2.0

**Versão:** 1.0 · **Data:** 30/09/2026 · **Responsável:** Jussara Cavalcante (gerência do projeto / Head de IA) · **Base:** escopo v2.0 (seções 3.2, 8, 12 e 14), protocolo de pesquisa (DSR, ciclo 2), ADR-0003, ADR-0005, ADR-0006, revisão de QA de 30/09/2026.

---

## 1. Resumo executivo

A plataforma está publicada em produção (`fast-midia-tools.vercel.app`) com todas as funcionalidades do escopo operando de ponta a ponta: agenda com regras, briefing, geofence, check-in e check-out por GPS, posição ao vivo durante a gravação, comprovantes de 99, Kanban, mapa do dia, alertas, indicadores, cadastros, visão do analista e atualização em tempo real. Os quatro achados P1 da revisão de QA foram corrigidos.

O que separa o sistema do piloto **não é código**. Em 30/09 a gerência resolveu os bloqueadores de governança internamente: a empresa não possui DPO, então o **RIPD v1.0** e a **política BYOD** foram elaborados e aprovados pela gerência do projeto (`docs/lgpd/`), e a ciência formal da diretoria foi dispensada. Restam as contas dos Fasts vinculadas, os itens [VALIDAR] do RIPD e duas credenciais externas que tornam o piloto útil (conta de serviço do Google Calendar e Resend para e-mail).

Proposta: **piloto em duas ondas, com duração total de 3 semanas**, começando com 2 Fasts e um cliente, ampliando para toda a equipe na segunda semana e fechando com a avaliação do ciclo 2 da pesquisa. Critério de sucesso: os OKRs da seção 3.2 do escopo medidos em ambiente real, com ≥ 90% de check-ins dentro da geofence e ≥ 95% das corridas 99 com comprovante validado.

---

## 2. Objetivos do piloto

| # | Objetivo | Como será medido |
|---|---|---|
| O1 | Validar o fluxo operacional completo em campo (agendar → briefing → check-in → gravação → comprovantes → concluir) | 100% dos jobs do piloto percorrendo o fluxo sem intervenção manual no banco |
| O2 | Medir os OKRs do escopo em condições reais | Tela Indicadores, período do piloto |
| O3 | Avaliar a aceitação do rastreio na janela do job pelos Fasts (ADR-0005) | Cobertura do sinal (posições recebidas ÷ esperadas) e questionário de percepção |
| O4 | Levantar defeitos e fricções de usabilidade no celular (Android e iOS) | Registro de ocorrências no diário do piloto |
| O5 | Produzir evidências para o artefato de pesquisa (DSR, ciclo 2) | Protocolo de pesquisa, seção "Avaliação" |

---

## 3. Escopo do piloto

**Inclui:** todos os perfis (Admin, Supervisora, Analista, Fast); jobs reais com clientes reais a partir da onda 2; Google Calendar (quando a credencial existir); convite e recuperação de senha por e-mail (quando o Resend existir).

**Não inclui:** WhatsApp Cloud API e espelho no Notion (aguardam chip e token; a fila acumula sem afetar a operação); verificação automática da pasta no Drive (Apps Script); notificações push; app nativo (rastreio com tela apagada permanece fora do escopo).

---

## 4. Pré-requisitos e estado atual (checklist de prontidão)

| # | Item | Tipo | Estado em 30/09 | Responsável | Prazo |
|---|---|---|---|---|---|
| P1 | RIPD v1.0 e termo 2.0 aprovados internamente (sem DPO); confirmar os itens [VALIDAR] do RIPD (CNPJ, vínculo dos Fasts, canal do titular, prazo contábil) | **Bloqueador** | RIPD aprovado em 30/09; [VALIDAR] pendente | Gerência | 02/10 |
| P2 | Decisões 1 (rastreio na gravação) e 4 (BYOD) exercidas pela gerência; política BYOD publicada; comunicação aos Fasts | Necessário | Exercidas em 30/09; comunicar na sessão de onboarding | Gerência / Supervisora | D1 |
| P3 | Fasts do piloto cadastrados com e-mail correto e login vinculado | **Bloqueador** | 1 de 2 prontos (Fast "teste" sem login) | Supervisora | D0 |
| P4 | Conta de serviço do Google + delegação em todo o domínio (ADR-0006); `GOOGLE_SERVICE_ACCOUNT_JSON` no Vercel | Necessário | Pendente | TI | onda 1 |
| P5 | Resend: `RESEND_API_KEY`, `EMAIL_REMETENTE`, `EMAIL_SUPERVISORA` no Vercel | Necessário | Pendente | TI | onda 1 |
| P6 | Teste em aparelho real (Android/Chrome e iOS/Safari): instalação, permissões, check-in, posição ao vivo, câmera, offline | Necessário | Não executado (validado por simulação) | Gerência + 1 Fast | D0–D1 |
| P7 | Roteiro de onboarding do Fast (1 página) e sessão de 20 min | Necessário | A produzir (seção 7 deste plano) | Gerência / Supervisora | D1 |
| P8 | Geofences dos jobs da onda 1 confirmadas no mapa | Necessário | Job #7 com ponto não confirmado | Supervisora / Analista | D0 |
| P9 | Chip dedicado do WhatsApp + token; token do Notion | Desejável | Pendente | Breno / TI / Admin Notion | durante o piloto |
| P10 | Conexão Power BI ao schema `analytics` (usuário de leitura) | Desejável | Instruções em `docs/arquitetura.md` | TI / Gerência | onda 2 |
| P11 | Itens P2/P3 da revisão de QA (ícone iOS em PNG, confirmação no Kanban, aviso de Fast sem login na agenda) | Desejável | Backlog | Dev | durante o piloto |

**Prontidão técnica verificada em 30/09:** deploy da `main` publicado; manifesto, service worker e ícones respondendo; migrações 0001–0013 aplicadas; Realtime em 5 tabelas; fila de integrações sem erros; rastreio habilitado; termo 2.0 vigente.

---

## 5. Cronograma (3 semanas)

| Fase | Período | Atividades | Entregável |
|---|---|---|---|
| **D0 — Preparação** | 01/10 | P3, P8; sessão de teste em aparelho (P6) com a Diana no job #7; abrir diário do piloto | Checklist P6 preenchido; ocorrências registradas |
| **Onda 1 — Piloto restrito** | 02/10 a 08/10 | 2 Fasts, 1 analista, supervisora; 1 cliente parceiro; jobs reais após a comunicação do termo e da política BYOD aos Fasts; P4 e P5 configurados pela TI durante a semana | Relatório de onda 1 (defeitos, fricções, cobertura de sinal) |
| **Onda 2 — Equipe completa** | 09/10 a 15/10 | Todos os Fasts e analistas; Calendar e e-mail ativos; correções da onda 1 publicadas; Power BI conectado | Indicadores com n suficiente; painel executivo |
| **Avaliação** | 16/10 a 21/10 | Questionário de percepção (Fasts e gestão); consolidação dos OKRs; decisão go/no-go para operação plena; registro no protocolo de pesquisa (ciclo 2) | Relatório de avaliação do piloto; ata de decisão |

Marcos: **M-A** (D0) prontidão técnica e de dados confirmada; **M-B** (02/10) itens [VALIDAR] do RIPD confirmados e Fasts comunicados; **M-C** (09/10) credenciais externas ativas; **M-D** (21/10) go/no-go e designação do encarregado.

---

## 6. Matriz de responsabilidades (RACI)

| Atividade | Gerência (Jussara) | Supervisora | Analistas | Fasts | TI | DPO / Jurídico | Diretoria / RH |
|---|---|---|---|---|---|---|---|
| Aprovação do RIPD, do termo 2.0 e da política BYOD (sem DPO) | **A/R** | C | I | I | I | – | I |
| Decisões 1 (rastreio) e 4 (BYOD) | **A/R** | C | I | I | I | – | I |
| Cadastro e vínculo de contas dos Fasts | A | **R** | I | C | I | – | – |
| Credenciais Google Calendar e Resend | A | I | – | – | **R** | – | – |
| Teste em aparelho e onboarding | **A/R** | R | I | R | C | – | – |
| Operação diária (agenda, briefing, alertas, validação de 99) | I | **A/R** | R | R | – | – | – |
| Registro de ocorrências e diário do piloto | **A** | R | R | R | C | – | – |
| Consolidação dos indicadores e relatório | **A/R** | C | I | I | I | I | I |
| Decisão go/no-go | R | C | I | I | I | C | **A** |

R = executa · A = responde · C = consultado · I = informado

---

## 7. Roteiro de onboarding do Fast (1 página)

1. Receber o link de convite (WhatsApp ou e-mail) e abrir no celular.
2. Aceitar o **Termo de Ciência 2.0** (o app explica o que é coletado, quando e por quanto tempo; há botão Pausar durante a gravação).
3. Definir a senha em **Minha conta**.
4. Instalar: Android/Chrome → menu ⋮ → "Adicionar à tela inicial"; iOS/Safari → compartilhar → "Adicionar à Tela de Início".
5. Permissões: localização "enquanto usa o app" com precisão alta; câmera.
6. No dia do job: abrir **Hoje** → tocar no job → ler o briefing → **Cheguei no cliente** → manter a tela aberta durante a gravação → **Terminei a gravação** → anexar os dois comprovantes de 99 (foto ou print) → **Material entregue** após o upload no Drive.
7. Sem internet: check-in e check-out ficam guardados e são enviados sozinhos.
8. Dúvidas ou erro: registrar no grupo do piloto com print e horário.

---

## 8. Indicadores de aceite do piloto

| Indicador | Fonte | Meta (seção 3.2 do escopo) | Critério de aceite do piloto |
|---|---|---|---|
| Agendamentos com conflito ou duplo | Indicadores | 0 | 0 sem aprovação registrada |
| Jobs com briefing antes da gravação | Indicadores | 100% | ≥ 95% |
| Check-in dentro da geofence | Indicadores | ≥ 90% | ≥ 85% na onda 1, ≥ 90% na onda 2 |
| Corridas 99 com comprovante e trajeto validados | Indicadores | ≥ 95% | ≥ 90% |
| Fasts ativos no app | Indicadores | ≥ 90% | 100% dos Fasts do piloto com ≥ 1 check-in |
| Cobertura do sinal na gravação (posições recebidas ÷ esperadas) | `evento_localizacao` tipo `posicao` | — (novo, ADR-0005) | ≥ 70% com app em primeiro plano |
| Alertas resolvidos sem recriação | Alertas | — | ≥ 95% |
| Ocorrências P1 abertas ao final | Diário do piloto | — | 0 |
| Percepção de proporcionalidade do rastreio (Likert 1–5) | Questionário | — | média ≥ 3,5 |

---

## 9. Riscos e mitigações

| # | Risco | Prob. | Impacto | Mitigação | Dono |
|---|---|---|---|---|---|
| R1 | Ausência de encarregado (DPO) e itens [VALIDAR] do RIPD não confirmados | Média | Médio | RIPD v1.0 aprovado pela gerência sustenta o piloto; designar encarregado até 21/10; confirmar [VALIDAR] até 02/10; rastreio desligável em `configuracao.rastreio_habilitado` | Gerência |
| R2 | iOS interrompe o GPS em segundo plano; cobertura baixa | Alta | Médio | Orientar tela aberta; medir cobertura; app nativo fica como decisão futura | Gerência |
| R3 | Fast recusa o rastreio | Média | Médio | Termo claro, botão Pausar, transparência de consultas em Minha conta, sessão de esclarecimento | Supervisora / RH |
| R4 | Credenciais externas (Calendar, Resend) não chegam na onda 1 | Média | Médio | Agenda opera só com o banco; convites por link copiado; não bloqueia o piloto | TI |
| R5 | Bateria e dados no aparelho pessoal (BYOD) | Média | Médio | Política BYOD (decisão 4); envio a cada 30 s com filtro de deslocamento; retenção de 7 dias | RH / Diretoria |
| R6 | Geofence imprecisa gera exceções em excesso | Média | Baixo | Ponto automático por endereço + confirmação manual; raio ajustável por job | Supervisora / Analista |
| R7 | Falha de rede em campo | Média | Baixo | Fila offline para check-in/out; comprovantes podem ser enviados depois | Dev |

---

## 10. Comunicação e suporte durante o piloto

- **Grupo do piloto** (WhatsApp): ocorrências com print e horário; resposta da gerência no mesmo dia.
- **Diário do piloto:** planilha ou página no Notion com data, perfil, tela, descrição, gravidade (P1/P2/P3) e status.
- **Ponto diário de 10 min** (supervisora + gerência) na onda 1; **semanal** na onda 2.
- **Correções:** publicadas pela esteira atual (branch → PR → CI → `main` → Vercel), com migrações versionadas.

---

## 11. Critérios de go/no-go (21/10)

**Go** para operação plena quando: itens [VALIDAR] do RIPD confirmados e Fasts comunicados; 0 ocorrências P1 abertas; indicadores da seção 8 atendidos; ≥ 80% dos Fasts com percepção ≥ 3 no questionário.
**No-go / prorrogação** quando: qualquer bloqueador aberto, ou check-in dentro da geofence < 85%, ou cobertura de sinal < 50% sem causa identificada.

---

## 12. Próximos passos imediatos

1. Confirmar os itens [VALIDAR] do RIPD e comunicar o termo 2.0 e a política BYOD aos Fasts (P1, P2).
2. Vincular o login do Fast "teste" ou substituí-lo por um Fast real; confirmar a geofence do job #7 (P3, P8).
3. Executar o teste em aparelho com a Diana no job #7 e registrar o resultado no diário (P6).
4. Encaminhar à TI a configuração do Google Calendar e do Resend com os passos da ADR-0006 e do `.env.example` (P4, P5).
5. Agendar a sessão de onboarding dos Fasts da onda 1 (P7).
