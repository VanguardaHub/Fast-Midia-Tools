# Relatório de Impacto à Proteção de Dados Pessoais (RIPD) — Fast Mídia Tools 2.0

**Versão:** 1.0 · **Data:** 30/09/2026 · **Elaboração:** gerência do projeto (Jussara Cavalcante, Head de IA, Vanguarda Martech) · **Base normativa:** Lei 13.709/2018 (LGPD), arts. 5º, 6º, 7º, 9º, 10, 15, 16, 18, 37, 38, 41, 46 a 50; Guia Orientativo da ANPD para elaboração de RIPD.
**Situação:** aprovado pela gerência do projeto para o piloto; a Vanguarda não possui encarregado (DPO) designado (ver seção 1.3).

> Definições confirmadas pela gerência em 30/09/2026: controladora "Vanguarda Martech"; Fasts com vínculo de pessoa jurídica (prestação de serviços); canal do titular na gerência do projeto; sem aparelho corporativo (BYOD integral). Pendente apenas o prazo contábil de guarda dos comprovantes, marcado **[VALIDAR contabilidade]**.

---

## 1. Identificação

### 1.1 Agente de tratamento
- **Controladora:** Vanguarda Martech, Manaus/AM (CNPJ a inserir na versão assinada).
- **Operadores (suboperadores de infraestrutura):** Supabase Inc. (banco de dados, autenticação e armazenamento; região São Paulo, `sa-east-1`); Vercel Inc. (hospedagem da aplicação; região São Paulo, `gru1`); Google LLC (Calendar, quando ativado; Geocoding, quando a chave existir); OpenStreetMap Foundation/Nominatim (geocodificação de endereços de clientes, sem dados pessoais); Resend (e-mail transacional, quando ativado); Meta Platforms (WhatsApp Cloud API, quando ativado); Notion Labs (espelho de status de jobs, quando ativado).

### 1.2 Projeto avaliado
Plataforma interna de gestão de jobs de campo da Fast Mídia (unidade da Vanguarda Martech): agenda, briefing, comprovação de presença por geolocalização, posição durante a gravação, comprovantes de corridas de aplicativo (99), Kanban, mapa, alertas e indicadores. Documento de escopo v2.0, seção 8.

### 1.3 Encarregado (DPO)
A empresa não possui encarregado designado. Para o piloto, a **gerência do projeto responde pelo canal do titular** (seção 8) e registra as decisões neste RIPD. Recomendação: designar formalmente um encarregado (pode ser pessoa interna, sem exclusividade) e publicar o contato no site institucional, conforme art. 41 da LGPD e Resolução CD/ANPD nº 18/2024. Prazo sugerido: até o fim do piloto (21/10/2026).

### 1.4 Motivo do RIPD
Tratamento de **dados de geolocalização de colaboradores** (dado pessoal com potencial de risco à liberdade e à privacidade), com **monitoramento periódico durante a gravação** (ADR-0005), e uso de imagens de comprovantes financeiros. Embora a localização não seja dado sensível (art. 5º, II), a ANPD e a jurisprudência tratam o rastreamento de trabalhadores como tratamento de risco elevado que justifica o RIPD (art. 38).

---

## 2. Necessidade e proporcionalidade

| Princípio (art. 6º) | Como é atendido |
|---|---|
| Finalidade | Comprovar presença do Fast no cliente, apoiar a supervisão durante a gravação e validar corridas de 99. Finalidades explícitas no termo de ciência 2.0 e no escopo (seções 3.2 e 4). |
| Adequação | Coleta compatível com o contexto: operação de equipe externa de audiovisual com janela de trabalho definida por job. |
| Necessidade | Coleta **mínima**: eventos por toque (chegada, saída, corrida) e, apenas entre o check-in e o check-out, posição a cada 30 s com o app aberto na tela do job. Nada fora da janela do job, nada em segundo plano, nada fora do expediente. Alternativas menos invasivas foram avaliadas (seção 4). |
| Livre acesso e transparência | O Fast vê seu histórico e **quem consultou sua posição** (Minha conta); termo em linguagem simples; indicador visível e botão Pausar durante o compartilhamento. |
| Qualidade | Precisão do GPS registrada em cada evento; leituras imprecisas exigem justificativa (check-in) ou são descartadas (posição). |
| Segurança | RLS em todas as tabelas; posições só saem por funções auditadas; buckets privados com URL assinada; TLS; segredos no Vercel; auditoria de alterações. |
| Prevenção | Retenção curta e expurgo automático; chave de desligamento do rastreio sem deploy; eventos imutáveis. |
| Não discriminação | Dados não são usados para avaliação de desempenho individual nem para ranking; qualquer uso desse tipo é gatilho de revisão (seção 8 do escopo). |
| Responsabilização | Este RIPD, ADRs 0003/0005, trilha de auditoria, registro de consentimentos por versão do termo. |

---

## 3. Descrição do tratamento

### 3.1 Titulares
- **Fasts** (equipe de campo): **prestadores de serviço pessoa jurídica (PJ)**, pessoas naturais que atuam por meio de suas empresas; a LGPD os protege como titulares (art. 5º, V). Cerca de 2 a 10 pessoas. No piloto: Diana Savi (diana.savi@vanguardamartech.com.br).
- **Supervisora, analistas e administradores:** usuários internos (identificação e ações no sistema).
- **Contatos de clientes:** nome e WhatsApp do contato comercial (dados de contato profissional).

### 3.2 Inventário de dados pessoais

| Categoria | Dados | Titular | Base legal (art. 7º) | Retenção | Onde |
|---|---|---|---|---|---|
| Identificação e acesso | nome, e-mail corporativo, telefone/WhatsApp, perfil de acesso | todos os usuários | V (execução de contrato de prestação de serviços) e IX (legítimo interesse: gestão de acessos) | enquanto houver contrato + 5 anos (prazo prescricional cível, CC art. 206, § 5º) | `perfil`, `fast`, `convite`, `auth.users` |
| Localização por evento | lat/lng, precisão, horário, distância à geofence, justificativa, em chegada/saída/corrida | Fasts | V (execução de contrato: comprovação da prestação) e IX (legítimo interesse: controle operacional e conciliação de despesas) | **90 dias** (`retencao_localizacao_dias`), expurgo diário automático | `evento_localizacao` |
| Localização periódica na gravação | lat/lng, precisão, horário, a cada ~30 s entre check-in e check-out | Fasts | IX (legítimo interesse: coordenação em tempo real da produção), com salvaguardas da seção 5 | **7 dias** (`retencao_rastreio_dias`), expurgo diário | `evento_localizacao` tipo `posicao` |
| Comprovantes de 99 | imagem/PDF do recibo (pode conter nome do passageiro, trajeto, valor, placa/nome do motorista), valor, origem/destino | Fasts (e terceiros incidentalmente: motorista) | V (reembolso/conciliação contratual) e II (obrigação legal: guarda de documentos fiscais/contábeis) | 5 anos [VALIDAR contabilidade] | bucket privado `comprovantes-99`, `corrida_99` |
| Consentimento e ciência | versão do termo, data/hora, user agent | Fasts | II/IX (comprovação de transparência) | enquanto houver vínculo + 5 anos | `consentimento`, `termo_ciencia` |
| Auditoria | quem alterou o quê, quem consultou posição de quem, quando | usuários internos | IX (segurança e responsabilização) | 5 anos | `auditoria` |
| Contato de cliente | nome e WhatsApp do contato | contato do cliente | IX (relação comercial) | enquanto ativo | `cliente` |

**Não há** tratamento de dados sensíveis (art. 5º, II), de crianças/adolescentes, nem decisões automatizadas com efeito jurídico (art. 20). A geometria bruta nunca entra nas views analíticas nem na trilha de auditoria.

### 3.3 Base legal: por que não "consentimento"
Os Fasts são prestadores PJ, mas pessoas naturais na relação de dependência econômica típica dessa contratação; o consentimento não é livre o bastante para sustentar o tratamento (assimetria). Por isso a base é **execução do contrato de prestação de serviços** (art. 7º, V: comprovação da presença contratada e reembolso de despesas) e **legítimo interesse** (art. 7º, IX, e art. 10: coordenação da produção), com **teste de balanceamento** na seção 4. A cláusula de tratamento de dados no contrato de prestação (ação A5) formaliza essa base. O **termo de ciência 2.0** cumpre o dever de **transparência** (art. 9º) e registra a ciência do titular; o "aceite" no app não é a base legal, é evidência de informação prévia. O botão Pausar é uma salvaguarda de proporcionalidade, não uma revogação de consentimento.

### 3.4 Fluxo do dado de localização
1. O Fast toca em "Cheguei" (ou, entre chegada e saída, o app lê o GPS a cada ~30 s com a tela do job aberta).
2. O aparelho envia ao servidor (TLS) apenas lat/lng, precisão e horário; o banco valida janela, consentimento, geofence e frequência e grava o evento imutável.
3. Supervisora/Admin consultam apenas por funções auditadas (mapa do dia, histórico do job); cada consulta gera registro visível ao Fast.
4. Expurgo automático diário (7 dias para posições; 90 para eventos) com registro na auditoria.
5. Nenhum compartilhamento com terceiros além dos operadores de infraestrutura; nenhuma transferência internacional fora do que os operadores realizam sob suas cláusulas-padrão (Supabase/Vercel operam em São Paulo; Google, Meta, Resend e Notion podem processar fora do Brasil, art. 33; aceito pela gerência, com dados mínimos nas mensagens e sem coordenadas).

---

## 4. Teste de balanceamento do legítimo interesse (art. 10)

| Etapa | Análise |
|---|---|
| Finalidade legítima | Coordenar a produção audiovisual em campo, comprovar a presença contratada e conciliar despesas de transporte. Interesse concreto, atual e lícito. |
| Necessidade | Sem a localização, a comprovação de presença dependeria de relato verbal e a conciliação do 99 de conferência manual, ambas fontes de conflito hoje (escopo, seção 2). Alternativas avaliadas: (a) só check-in/out por toque — insuficiente para a supervisão durante a gravação (pedido da gerência em 30/09); (b) rastreio contínuo em segundo plano — rejeitado como excessivo; (c) posição periódica **apenas na janela da gravação, com app aberto** — adotada como o mínimo que atende à finalidade. |
| Expectativas do titular | Profissional de campo que já reporta presença ao cliente; é informado antes, vê o indicador e pode pausar; sabe quem consultou. Expectativa razoável de que a empresa saiba onde ocorre a gravação contratada. |
| Impacto e salvaguardas | Impacto limitado a horário e local de trabalho; retenção de 7 dias; sem uso para avaliação de desempenho; acesso restrito e auditado; desligamento imediato possível pela configuração. |
| Conclusão | O interesse da controladora prevalece, desde que mantidas as salvaguardas da seção 5 e o gatilho de revisão da seção 8. |

---

## 5. Medidas de segurança e salvaguardas implementadas

| Medida | Implementação verificada |
|---|---|
| Minimização por regra de banco | Trigger recusa posição fora da janela, sem consentimento do termo vigente, fora do intervalo chegada→saída; limita a 1 posição/30 s; descarta leituras com precisão > 150 m no aparelho |
| Segregação de acesso | RLS em 100% das tabelas; Fast lê só os próprios eventos; gestão só via RPC `security definer` que registra auditoria |
| Transparência ativa | Termo 2.0 com aceite versionado; indicador "posição compartilhada" e botão Pausar; "Quem consultou minha posição" em Minha conta |
| Retenção e descarte | `pg_cron` diário: 7 dias (posição) e 90 dias (eventos); comprovantes conforme prazo contábil [VALIDAR contabilidade] |
| Integridade | Eventos de localização imutáveis (trigger); auditoria de alterações em job, briefing, exceção, corrida e Fast |
| Confidencialidade em trânsito e repouso | TLS; buckets privados com URL assinada de 10 min; chaves de serviço apenas no servidor (Vercel) |
| Controle de mudança | Migrações versionadas; CI com varredura de segredos; ADRs |
| Chave de desligamento | `configuracao.rastreio_habilitado = false` interrompe a captura sem deploy, com auditoria |
| Resposta a incidentes | Ver seção 7 |

---

## 6. Análise de riscos

Escala: probabilidade e impacto de 1 (baixo) a 3 (alto); nível = P × I.

| # | Risco ao titular | P | I | Nível | Mitigação | Residual |
|---|---|---|---|---|---|---|
| R1 | Uso da localização para fins diversos (avaliação, punição) — desvio de finalidade | 2 | 3 | 6 | Finalidade limitada no termo; dados não entram nas views analíticas por pessoa fora dos OKRs operacionais; gatilho de revisão; auditoria de consultas visível ao Fast | 2 |
| R2 | Acesso indevido por usuário interno | 1 | 3 | 3 | RLS, RPC auditada, perfis mínimos, log de consultas | 1 |
| R3 | Vazamento por incidente no operador (Supabase/Vercel) | 1 | 3 | 3 | Operadores com certificações SOC 2/ISO 27001; retenção curta reduz exposição; sem geometria em views externas | 1 |
| R4 | Coleta além do necessário por falha do app (ex.: em segundo plano) | 1 | 2 | 2 | Regras no banco independem do app; janela/frequência impostas no servidor; teste em aparelho | 1 |
| R5 | Comprovante de 99 expõe dados de terceiro (motorista) | 2 | 1 | 2 | Bucket privado; acesso restrito ao job; orientação para recortar o print quando possível | 1 |
| R6 | Titular sem canal efetivo para exercer direitos (sem DPO) | 2 | 2 | 4 | Gerência assume o canal no piloto; designar encarregado até 21/10 | 2 |
| R7 | Transferência internacional por operadores de mensageria/calendário | 2 | 1 | 2 | Ativação só com credencial aprovada; cláusulas-padrão dos provedores; dados mínimos nas mensagens (sem coordenadas) | 1 |
| R8 | Retenção acima do necessário para comprovantes | 1 | 1 | 1 | Prazo a definir com a contabilidade [VALIDAR contabilidade] | 1 |
| R9 | Fast sem aparelho compatível ou sem dados móveis (não há aparelho corporativo) | 2 | 1 | 2 | Política BYOD: ajuste de escala sem penalidade; consumo medido no piloto; fila offline para check-in/out | 1 |

Nenhum risco residual acima de 2. **Parecer:** tratamento proporcional e adequado, autorizado para o piloto.

---

## 7. Direitos do titular e resposta a incidentes

**Canal do titular (art. 18):** e-mail da gerência do projeto (jussara.cavalcante@vanguardamartech.com.br) e, dentro do app, Minha conta. Prazo de resposta: 15 dias. Titular do piloto: Diana Savi (diana.savi@vanguardamartech.com.br), comunicada na sessão de onboarding.
Direitos atendidos: confirmação e acesso (histórico e consultas em Minha conta); correção (via supervisão, com trilha); anonimização/eliminação (expurgo automático; pedido antecipado avaliado caso a caso quando não houver obrigação de guarda); informação sobre compartilhamento (seção 3.4); revogação de ciência (o Fast pode pausar o compartilhamento; a recusa definitiva do tratamento de presença é tratada como questão contratual, não de consentimento).

**Incidentes (art. 48):** ao identificar acesso indevido, vazamento ou perda: (1) isolar (revogar chaves/sessões, desligar rastreio); (2) registrar em auditoria e no diário do piloto; (3) avaliar risco ao titular; (4) comunicar aos titulares afetados e à ANPD em até 3 dias úteis quando houver risco relevante (Resolução CD/ANPD nº 15/2024); (5) revisar este RIPD.

---

## 8. Gatilhos de revisão deste RIPD

- Qualquer ampliação de coleta: rastreio fora da janela, em segundo plano, ou com o app fechado (exigiria app nativo).
- Uso dos dados para avaliação de desempenho, ranking ou decisões automatizadas sobre pessoas.
- Alteração dos prazos de retenção (`retencao_localizacao_dias`, `retencao_rastreio_dias`).
- Ativação de novos operadores (WhatsApp, Notion, Google) ou transferência internacional.
- Incidente de segurança envolvendo dados de localização.
- Designação do encarregado (para revisão formal).

---

## 9. Aprovação

| Papel | Nome | Decisão | Data |
|---|---|---|---|
| Gerência do projeto (responsável pelo tratamento no piloto) | Jussara Cavalcante | Aprovado para o piloto, com as ações da seção 10 | 30/09/2026 |
| Encarregado (a designar) | — | — | — |

## 10. Plano de ação decorrente

| # | Ação | Responsável | Prazo |
|---|---|---|---|
| A1 | Confirmar o prazo contábil de guarda dos comprovantes e inserir o CNPJ na versão assinada (demais itens confirmados em 30/09) | Gerência / Contabilidade | 02/10 |
| A2 | Publicar o termo 2.0 como anexo deste RIPD e comunicar os Fasts antes do primeiro job real | Gerência / Supervisora | 02/10 |
| A3 | Designar encarregado (art. 41) e registrar contato | Diretoria (informada) / Gerência | 21/10 |
| A4 | Revisar prazos de retenção após o piloto (decisão 7 da seção 14) | Gerência | 21/10 |
| A5 | Incluir cláusula de tratamento de dados no contrato de prestação de serviços (PJ) dos Fasts, referenciando este RIPD e a política BYOD | Gerência (com apoio jurídico externo, se houver) | onda 2 |
