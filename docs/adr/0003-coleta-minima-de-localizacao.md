# ADR-0003 — Coleta mínima de localização: eventos do job, com o app aberto, retenção de 90 dias

**Status:** Aceito (condicionado ao RIPD e à decisão 1 da seção 14)
**Contexto:** Localização de colaborador é dado pessoal e rastreio contínuo pode ser considerado excessivo (seção 8). A finalidade é comprovar presença e validar corridas de 99.
**Decisão:**
1. Captura apenas em `chegada`, `saida` e `corrida`, por ação explícita do Fast (`getCurrentPosition`, nunca `watchPosition`), com indicador visível.
2. O banco recusa eventos fora da janela do job (`janela_checkin_antes_min`/`depois_min`) e sem consentimento do termo vigente.
3. Eventos são imutáveis e expurgados automaticamente após `retencao_localizacao_dias` (90) por `pg_cron`, com registro em `auditoria`.
4. Supervisora/Admin não leem `evento_localizacao` diretamente: apenas por RPCs que registram quem consultou a posição de quem; o Fast vê o próprio histórico e o log de consultas em `/conta`.
5. A geometria bruta nunca entra na trilha de auditoria nem nas views analíticas.
**Consequências:** Sem trajeto contínuo, a conciliação do 99 usa destino informado + geofence (RF-43), não o percurso. Qualquer ampliação (rastreio na janela, avaliação de desempenho) exige novo RIPD e decisão da diretoria (gatilho de revisão).
