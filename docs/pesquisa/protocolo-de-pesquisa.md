# Protocolo de Pesquisa Aplicada — Fast Mídia Tools 2.0

**Pesquisadora responsável:** Jussara Nonata Cavalcante (Head de IA, Vanguarda Martech; mestranda em Projetos, Processos e Qualidade)
**Organização-campo:** Setor Fast Mídia — Vanguarda Martech (Manaus/AM)
**Versão:** 1.0 · Setembro/2026 · Documento vivo, revisado a cada gate do projeto
**Documento-base:** *Fast Mídia Tools 2.0 — Documento de Escopo do Projeto* (29/09/2026)

---

## 1. Enquadramento

Este projeto é conduzido como **pesquisa aplicada** sob o método **Design Science Research (DSR)** (Hevner et al., 2004; Peffers et al., 2007; Dresch, Lacerda & Antunes, 2015). O artefato é uma plataforma corporativa de gestão de jobs de campo com comprovação de presença por geolocalização e controle de transporte por aplicativo, avaliada em ambiente real de operação.

A escolha do DSR decorre da natureza do problema: não se trata apenas de descrever um fenômeno, mas de **projetar, construir e avaliar** um artefato que resolva um problema organizacional relevante, produzindo conhecimento prescritivo (regras de projeto) generalizável a outros setores de serviço em campo.

| Elemento DSR | Instanciação neste projeto |
|---|---|
| Problema | Processos operacionais existem em documento (v1.0), mas o sistema (Apps Script) não os aplica: exposição pública, regras de agenda não impostas, ausência de prova de presença e controle retroativo do 99 (diagnóstico, seção 2.2 do escopo). |
| Artefato | Plataforma composta por banco geoespacial com regras aplicadas por sistema (Supabase/PostGIS), PWA de campo e painel da supervisora (Next.js/Vercel), com camada de integração idempotente. |
| Avaliação | Piloto de 2 semanas com 2 Fasts (EAP 4.2), medido pelos OKRs da seção 3.2 e critérios de aceite da seção 13.3. |
| Contribuição | Regras de projeto para geolocalização mínima e proporcional em relações de trabalho (LGPD), e evidências sobre aplicação de regras de negócio no banco como mecanismo de conformidade. |

## 2. Problema de pesquisa

> Como projetar uma plataforma de gestão de jobs de campo que aplique por sistema as regras operacionais, comprove a presença do colaborador no cliente e concilie despesas de transporte, mantendo coleta mínima de dados pessoais e conformidade com a LGPD?

### 2.1 Questões de pesquisa

- **QP1.** A aplicação das regras operacionais (buffer de 2h, agendamento duplo, briefing obrigatório, bloqueio de conclusão sem comprovantes) na camada de dados elimina os conflitos observados no processo manual?
- **QP2.** O check-in/check-out por geofence com captura pontual (sem rastreamento contínuo) é suficiente para comprovar presença com precisão aceitável em ambiente urbano amazônico (Manaus), em Android e iOS?
- **QP3.** A conciliação de corridas de 99 no próprio app, com bloqueio preventivo, reduz o tempo da supervisora e aumenta a taxa de corridas validadas?
- **QP4.** Quais garantias técnicas (minimização, retenção automática, log de consultas, consentimento versionado) são necessárias para que o desenho seja aceito pelo DPO e pelos colaboradores?

### 2.2 Hipóteses (testáveis no piloto)

| ID | Hipótese | Métrica | Meta (seção 3.2) |
|---|---|---|---|
| H1 | Regras no banco eliminam agendamentos em conflito. | Agendamentos com conflito ou duplo sem aprovação | 0 |
| H2 | Briefing obrigatório no app garante 100% de briefings antes da gravação. | Jobs com briefing preenchido antes do check-in | 100% |
| H3 | Geofence de 200 m com precisão ≤ 100 m comprova presença na maioria dos jobs. | Check-ins dentro da geofence | ≥ 90% |
| H4 | Bloqueio preventivo aumenta a validação de corridas. | Corridas com comprovante e trajeto validados | ≥ 95% |
| H5 | Conciliação no app reduz o esforço da supervisora. | Tempo de conciliação do 99 (medido por observação) | −70% |
| H6 | Coleta mínima e transparente obtém adoção. | Fasts ativos no app durante o piloto | ≥ 90% |
| H7 | Desenho de privacidade não gera incidentes. | Incidentes de privacidade | 0 |

## 3. Método

### 3.1 Ciclos DSR (Peffers et al., 2007) mapeados nas fases do escopo

| Etapa DSR | Fase do projeto | Evidência produzida |
|---|---|---|
| 1. Identificação do problema | Diagnóstico (seção 2) | Tabela de lacunas 1–8 com evidência no código |
| 2. Objetivos da solução | Seção 3 (objetivos, OKRs) | OKRs com linha de base medida na Fase 0 |
| 3. Projeto e desenvolvimento | Fases 1–3 | Migrações versionadas, RLS, PWA, painel, ADRs |
| 4. Demonstração | Demonstração ao fim de cada fase (13.1) | Atas, checklist de saída de cada pacote |
| 5. Avaliação | Piloto (Fase 4.2) e go/no-go (M5) | Indicadores automáticos (`analytics.indicadores_okr`), questionário de usabilidade, observação |
| 6. Comunicação | Relatório executivo quinzenal; artigo | Relatório ao comitê; artigo científico (meta de publicação) |

### 3.2 Coleta de dados

| Fonte | Instrumento | Variáveis |
|---|---|---|
| Sistema | Views `analytics.vw_jobs`, `analytics.vw_gasto_99`; função `analytics.indicadores_okr(inicio, fim)` | Todas as métricas de H1–H4, H6; atraso médio de check-in; duração real da gravação; precisão do GPS |
| Auditoria | Tabela `auditoria` (ações, consultas de posição, expurgo) | H7; rastreabilidade de exceções e decisões |
| Observação | Cronometragem da conciliação antes/depois (3 dias cada) | H5 |
| Questionário | SUS (System Usability Scale) + 3 perguntas abertas, aplicado aos 2 Fasts e à supervisora ao fim do piloto | Usabilidade (critério 13.3), percepção de privacidade |
| Teste de campo | Matriz de dispositivos (Android/Chrome, iOS/Safari) em locais internos e externos | RNF-06, RNF-10, R5, R6 |

### 3.3 Análise

Estatística descritiva das métricas por semana do piloto; comparação com a linha de base da Fase 0; análise temática das respostas abertas. Não há inferência estatística formal dada a amostra (n = 2 Fasts); o piloto tem caráter de **estudo de viabilidade**, e a generalização é analítica (regras de projeto), não estatística.

## 4. Artefato — princípios de projeto (design principles)

1. **Regras de negócio no banco** (triggers, constraints de exclusão, RLS), não apenas na interface — a conformidade não depende do cliente.
2. **Coleta mínima e proporcional**: localização apenas em eventos do job, com o app aberto, dentro da janela; nunca em segundo plano.
3. **Transparência verificável**: indicador de captura, termo versionado com aceite registrado, histórico de quem consultou a posição de quem.
4. **Retenção automática** (90 dias) executada pelo próprio banco e auditada.
5. **Degradação graciosa**: integrações externas (Notion, Calendar, WhatsApp) em fila idempotente; a operação nunca depende delas.
6. **Exceção é exceção**: todo desvio de regra exige motivo, decisão e registro (Processos, seção 6).

## 5. Ética e conformidade (seção 8 do escopo)

- Localização de colaborador é dado pessoal; o desenho adota **minimização, finalidade explícita e transparência**.
- A base legal (execução de contrato ou legítimo interesse com teste de balanceamento) será definida pelo jurídico/DPO; o consentimento é tratado como **evidência de ciência**, não como base legal única, dada a assimetria da relação de trabalho.
- O **RIPD** deve ser aprovado antes do piloto com GPS (M3, semana 9). Sem RIPD, o piloto ocorre sem captura de localização.
- Participação no piloto é informada; os participantes recebem o termo de ciência e o canal do DPO.
- Qualquer proposta de rastreio contínuo, uso para avaliação de desempenho ou ampliação de público exige novo RIPD e nova decisão da diretoria (gatilho de revisão).
- Dados armazenados na região `sa-east-1` (São Paulo), verificando a cláusula de transferência internacional com os operadores (Supabase, Vercel, Meta).

## 6. Cronograma da pesquisa (alinhado ao roadmap de 12 semanas)

| Semana | Atividade de pesquisa |
|---|---|
| 1–2 | Linha de base: extrair do Notion os últimos 60 dias (conflitos, briefings, comprovantes); cronometrar conciliação atual |
| 2–5 | Registro dos ADRs; validação das regras com a supervisora (QP1) |
| 4–7 | Teste de campo de GPS (QP2): 10 leituras por dispositivo em 5 locais |
| 6–9 | Validação do painel; parecer do DPO (QP4) |
| 10–11 | Piloto: coleta contínua de métricas; questionário SUS ao final |
| 12 | Análise, relatório de avaliação, go/no-go, redação do artigo |

## 7. Riscos à validade

| Risco | Mitigação |
|---|---|
| Efeito de novidade no piloto (Hawthorne) | Comparar semanas 1 e 2 do piloto; observar sem intervenção |
| Precisão de GPS variável por local | Registrar precisão em cada evento; analisar por local (interno/externo) |
| Amostra pequena | Tratar como estudo de viabilidade; replicação prevista na Fase 5 |
| Indefinição das decisões da seção 14 | Prazo por decisão; comitê quinzenal |

## 8. Produtos esperados

1. Artefato em produção (plataforma) com código versionado e documentação.
2. Relatório de avaliação do piloto (evidências para o go/no-go).
3. Conjunto de princípios de projeto para geolocalização proporcional em serviços de campo.
4. Artigo científico (alvo: evento/periódico de gestão de projetos, sistemas de informação ou governança de dados) e capítulo de dissertação.

## Referências

- Dresch, A.; Lacerda, D. P.; Antunes Jr., J. A. V. (2015). *Design Science Research: método de pesquisa para avanço da ciência e tecnologia*. Bookman.
- Hevner, A. R.; March, S. T.; Park, J.; Ram, S. (2004). Design Science in Information Systems Research. *MIS Quarterly*, 28(1), 75–105.
- Peffers, K.; Tuunanen, T.; Rothenberger, M. A.; Chatterjee, S. (2007). A Design Science Research Methodology for Information Systems Research. *JMIS*, 24(3), 45–77.
- Brooke, J. (1996). SUS: A quick and dirty usability scale. In *Usability Evaluation in Industry*.
- Brasil. Lei nº 13.709/2018 (LGPD). ANPD, *Guia orientativo para elaboração de RIPD*.
- PMI (2021). *PMBOK Guide*, 7ª ed.
