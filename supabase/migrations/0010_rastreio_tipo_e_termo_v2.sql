-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0010: rastreio na janela do job (RF-38) — parte 1/2
-- Decisão 1 da seção 14 exercida em 30/09/2026 pela gerência do projeto: posição do Fast
-- em tempo real durante a gravação. Ver docs/adr/0005-rastreio-na-janela-do-job.md.
-- Esta migração só cria o novo valor do enum, as configurações e o termo 2.0;
-- o valor 'posicao' não pode ser usado na mesma transação em que é criado (PostgreSQL),
-- por isso as regras ficam na migração 0011.
-- ============================================================

alter type public.evento_localizacao_tipo add value if not exists 'posicao';

insert into public.configuracao (chave, valor, descricao) values
  ('rastreio_habilitado',        'true', 'RF-38: compartilhar posição do Fast entre chegada e saída, com o app aberto (decisão 1, seção 14)'),
  ('rastreio_intervalo_s',       '30',   'RF-38: intervalo mínimo entre posições de rastreio aceitas por job (segundos)'),
  ('retencao_rastreio_dias',     '7',    'RF-38 / seção 8: retenção das posições de rastreio (menor que a dos eventos de check-in/out)'),
  ('auditoria_mapa_janela_min',  '10',   'RNF-04: consultas ao mapa do dia pelo mesmo usuário dentro desta janela contam como uma consulta na auditoria')
on conflict (chave) do nothing;

-- Termo de ciência 2.0: inclui o compartilhamento de posição durante a gravação (novo aceite obrigatório)
update public.termo_ciencia set vigente = false where vigente;
insert into public.termo_ciencia (versao, titulo, conteudo, vigente) values (
  '2.0',
  'Termo de Ciência — Localização em Eventos do Job e Posição Durante a Gravação',
  'Declaro estar ciente de que o aplicativo Fast Mídia Tools captura a minha localização geográfica '
  || '(1) nos eventos de check-in (chegada), check-out (saída) e registro de corrida de transporte, e '
  || '(2) de forma periódica, a cada cerca de 30 segundos, apenas no intervalo entre o meu check-in e o meu check-out, '
  || 'com o aplicativo aberto na tela do job e com indicador visível, podendo pausar o compartilhamento a qualquer momento. '
  || 'A finalidade é comprovar presença no cliente, apoiar a supervisão durante a gravação e validar corridas de 99. '
  || 'Nenhuma captura ocorre fora da janela do job, fora do expediente ou em segundo plano. '
  || 'As posições periódicas são excluídas automaticamente após 7 dias e os eventos de chegada, saída e corrida após 90 dias. '
  || 'Somente Supervisora e Admin consultam posições, e cada consulta é registrada. '
  || 'Posso solicitar acesso, correção ou contestação de um registro pelo canal do DPO. '
  || 'Este termo não substitui a política de privacidade e o RIPD aprovados pelo jurídico/DPO da Vanguarda.',
  true
) on conflict (versao) do nothing;

update public.configuracao set valor = '"2.0"' where chave = 'versao_termo_vigente';

comment on table public.evento_localizacao is
  'Eventos de chegada, saída e corrida (por toque) e posições periódicas (tipo posicao) apenas entre chegada e saída, com o app aberto. Retenção automática (seção 8, ADR-0005).';
