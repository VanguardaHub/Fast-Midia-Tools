-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0001: extensões, tipos e configuração
-- Referência: Documento de Escopo, seções 7.1 (arquitetura) e 7.2 (modelo)
-- ============================================================

create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron;

-- ---------- Tipos enumerados ----------
create type public.perfil_tipo as enum ('fast', 'analista', 'supervisora', 'admin');

-- Status iguais aos do Notion (config.exemplo.gs → CONFIG.STATUS)
create type public.job_status as enum (
  'aguardando_briefing', 'briefing_recebido', 'em_gravacao',
  'material_entregue', 'em_edicao', 'concluido', 'cancelado'
);

create type public.slot_tipo as enum ('manha', 'tarde');
create type public.evento_localizacao_tipo as enum ('chegada', 'saida', 'corrida');
create type public.sentido_corrida as enum ('ida', 'volta');

create type public.excecao_tipo as enum (
  'buffer_2h', 'agendamento_duplo', 'checkin_fora_geofence',
  'checkin_baixa_precisao', 'sem_briefing', 'troca_fast', 'outro'
);

create type public.alerta_tipo as enum (
  'briefing_atrasado', 'checkin_atrasado', 'checkin_fora_geofence',
  'checkin_baixa_precisao', 'material_nao_entregue_24h',
  'comprovante_faltando', 'destino_divergente', 'excecao_pendente'
);

create type public.integracao_tipo as enum (
  'notion_upsert', 'calendar_upsert', 'calendar_delete',
  'whatsapp_send', 'email_send', 'push_send', 'drive_verificar'
);
create type public.integracao_status as enum ('pendente', 'processando', 'ok', 'erro', 'descartado');

-- ---------- Configuração operacional (RF-33, RNF-04, RNF-06) ----------
create table public.configuracao (
  chave         text primary key,
  valor         jsonb not null,
  descricao     text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
comment on table public.configuracao is 'Parâmetros operacionais editáveis pelo Admin sem alterar código.';

insert into public.configuracao (chave, valor, descricao) values
  ('buffer_minimo_minutos',      '120',  'Folga mínima entre jobs do mesmo Fast (Processos 1.2 / RF-12)'),
  ('raio_geofence_padrao_m',     '200',  'Raio padrão da geofence por job (RF-33)'),
  ('precisao_maxima_m',          '100',  'Precisão máxima aceita do GPS sem justificativa (RNF-06)'),
  ('retencao_localizacao_dias',  '90',   'Retenção automática dos eventos de localização (RNF-04, seção 8)'),
  ('janela_checkin_antes_min',   '120',  'Minutos antes do início do job em que o check-in é aceito (RF-35)'),
  ('janela_checkin_depois_min',  '240',  'Minutos após o fim do job em que o check-out é aceito (RF-35)'),
  ('prazo_material_horas',       '24',   'Prazo de entrega do material bruto após o fim da gravação (Processos 1.3)'),
  ('atraso_checkin_alerta_min',  '30',   'Minutos após o início sem check-in para gerar alerta (RF-52)'),
  ('timezone',                   '"America/Sao_Paulo"', 'Fuso horário operacional'),
  ('slots', '{"manha":{"inicio":8,"fim":12,"label":"08:00 – 12:00"},"tarde":{"inicio":13,"fim":17,"label":"13:00 – 17:00"}}', 'Slots de gravação (MVP atual)'),
  ('dominios_email_permitidos',  '["vanguardamartech.com.br"]', 'Domínios aceitos no login corporativo (RF-01)'),
  ('versao_termo_vigente',       '"1.0"', 'Versão do termo de ciência exigida para coleta de localização');

create or replace function public.cfg_int(p_chave text) returns integer
language sql stable as $$
  select (valor)::text::integer from public.configuracao where chave = p_chave
$$;

create or replace function public.cfg_text(p_chave text) returns text
language sql stable as $$
  select valor #>> '{}' from public.configuracao where chave = p_chave
$$;

create or replace function public.cfg_json(p_chave text) returns jsonb
language sql stable as $$
  select valor from public.configuracao where chave = p_chave
$$;

-- Trigger genérico de atualizado_em
create or replace function public.tg_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
