-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0002: modelo de dados (seção 7.2)
-- ============================================================

-- ---------- Identidade (RF-01, RF-02) ----------
create table public.perfil (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome          text not null,
  email         text not null unique,
  perfil        public.perfil_tipo not null default 'fast',
  telefone      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.perfil is 'Perfil de acesso vinculado ao auth.users. Perfis: fast, analista, supervisora, admin.';
create trigger perfil_atualizado_em before update on public.perfil
  for each row execute function public.tg_atualizado_em();

-- Convites: permitem login de e-mails fora do domínio corporativo (ex.: Fast com Gmail)
create table public.convite (
  email      text primary key,
  nome       text,
  perfil     public.perfil_tipo not null default 'fast',
  criado_por uuid references public.perfil (id),
  criado_em  timestamptz not null default now(),
  usado_em   timestamptz
);

-- ---------- Fast (RF-03) — substitui a lista fixa em config.gs ----------
create table public.fast (
  id               uuid primary key default gen_random_uuid(),
  perfil_id        uuid unique references public.perfil (id) on delete set null,
  nome             text not null unique,
  email_calendario text not null unique,
  telefone         text,
  cor              text not null default '#7C3AED' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  nome_notion      text,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
comment on table public.fast is 'Cadastro de Fasts (RF-03). email_calendario é o Google Calendar lido pelo Apps Script.';
create trigger fast_atualizado_em before update on public.fast
  for each row execute function public.tg_atualizado_em();

-- ---------- Cliente — espelha CRIAÇÃO/[ANO]/[CLIENTE] no Drive (RF-16) ----------
create table public.cliente (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null unique,
  grupo            text,
  pasta_drive_id   text,
  pasta_drive_url  text,
  contato_nome     text,
  contato_whatsapp text,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create trigger cliente_atualizado_em before update on public.cliente
  for each row execute function public.tg_atualizado_em();

-- ---------- Job (RF-10 a RF-16, RF-33) ----------
create table public.job (
  id                        uuid primary key default gen_random_uuid(),
  codigo                    bigint generated always as identity unique,
  cliente_id                uuid not null references public.cliente (id),
  fast_id                   uuid not null references public.fast (id),
  analista_id               uuid references public.perfil (id),
  analista_whatsapp         text,
  data                      date not null,
  slot                      public.slot_tipo not null,
  inicio                    timestamptz not null,
  fim                       timestamptz not null,
  prazo_material            date,
  data_edicao               date,
  bloco_edicao              public.slot_tipo,
  status                    public.job_status not null default 'aguardando_briefing',
  endereco                  text,
  ponto                     extensions.geography(Point, 4326),
  ponto_confirmado          boolean not null default false,
  raio_geofence_m           integer not null default 200 check (raio_geofence_m between 20 and 5000),
  precisa_99                boolean not null default false,
  pasta_ingest_url          text,
  notion_page_id            text,
  calendar_event_id         text,
  calendar_event_edicao_id  text,
  observacoes               text,
  excecao_motivo            text,
  duracao_real_min          integer,
  material_entregue_em      timestamptz,
  cancelado_em              timestamptz,
  motivo_cancelamento       text,
  criado_por                uuid references public.perfil (id) default auth.uid(),
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),
  constraint job_edicao_completa check ((data_edicao is null) = (bloco_edicao is null)),
  constraint job_intervalo_valido check (fim > inicio)
);
comment on table public.job is 'Job de gravação. Status espelhados no Notion. ponto/raio definem a geofence (RF-31, RF-33).';
comment on column public.job.excecao_motivo is 'Preenchido apenas por Supervisora/Admin ao aprovar exceção de buffer 2h ou agendamento duplo (RF-12, RF-13).';

-- RF-14: bloqueio atômico do slot — dois usuários simultâneos não conseguem o mesmo slot
create unique index job_slot_unico on public.job (fast_id, data, slot) where status <> 'cancelado';
-- Sobreposição de intervalos do mesmo Fast é impossível mesmo com horários customizados
alter table public.job add constraint job_sem_sobreposicao
  exclude using gist (fast_id extensions.gist_uuid_ops with =, tstzrange(inicio, fim) with &&)
  where (status <> 'cancelado');
create index job_data_idx on public.job (data);
create index job_status_idx on public.job (status);
create index job_fast_data_idx on public.job (fast_id, data);
create index job_ponto_gix on public.job using gist (ponto);
create trigger job_atualizado_em before update on public.job
  for each row execute function public.tg_atualizado_em();

-- ---------- Briefing (RF-20 a RF-22) ----------
create table public.briefing (
  id                     uuid primary key default gen_random_uuid(),
  job_id                 uuid not null unique references public.job (id) on delete cascade,
  local                  text not null,
  roteiro                text not null,
  referencia_visual_path text,
  observacoes            text,
  precisa_99             boolean not null default false,
  preenchido_por         uuid references public.perfil (id) default auth.uid(),
  preenchido_em          timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
comment on table public.briefing is 'Briefing obrigatório antes do check-in (Processos 2.1, RF-21).';
create trigger briefing_atualizado_em before update on public.briefing
  for each row execute function public.tg_atualizado_em();

-- ---------- Evento de localização (RF-31 a RF-37, RNF-04) ----------
create table public.evento_localizacao (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references public.job (id) on delete cascade,
  fast_id            uuid not null references public.fast (id),
  tipo               public.evento_localizacao_tipo not null,
  ponto              extensions.geography(Point, 4326) not null,
  precisao_m         numeric(8, 1) not null check (precisao_m >= 0),
  capturado_em       timestamptz not null,
  dentro_geofence    boolean,
  distancia_m        numeric(10, 1),
  justificativa      text,
  origem_offline     boolean not null default false,
  chave_idempotencia text unique,
  criado_em          timestamptz not null default now()
);
comment on table public.evento_localizacao is 'Coleta mínima: apenas chegada, saída e corrida, com o app aberto. Retenção automática (seção 8).';
create unique index evento_localizacao_unico_por_tipo
  on public.evento_localizacao (job_id, tipo) where tipo in ('chegada', 'saida');
create index evento_localizacao_job_idx on public.evento_localizacao (job_id);
create index evento_localizacao_fast_capturado_idx on public.evento_localizacao (fast_id, capturado_em desc);
create index evento_localizacao_capturado_idx on public.evento_localizacao (capturado_em);

-- ---------- Corrida 99 (RF-40 a RF-44) ----------
create table public.corrida_99 (
  id                   uuid primary key default gen_random_uuid(),
  job_id               uuid not null references public.job (id) on delete cascade,
  sentido              public.sentido_corrida not null,
  valor                numeric(10, 2) check (valor >= 0),
  comprovante_path     text,
  origem               text,
  destino              text,
  destino_ponto        extensions.geography(Point, 4326),
  divergencia_destino  boolean,
  validada             boolean not null default false,
  validada_por         uuid references public.perfil (id),
  validada_em          timestamptz,
  registrado_por       uuid references public.perfil (id) default auth.uid(),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  unique (job_id, sentido)
);
create trigger corrida_99_atualizado_em before update on public.corrida_99
  for each row execute function public.tg_atualizado_em();

-- ---------- Exceção (RF-34, RF-53, Processos 6) ----------
create table public.excecao (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.job (id) on delete cascade,
  tipo           public.excecao_tipo not null,
  motivo         text not null,
  solicitada_por uuid references public.perfil (id) default auth.uid(),
  aprovada       boolean,
  decidida_por   uuid references public.perfil (id),
  decidida_em    timestamptz,
  parecer        text,
  criado_em      timestamptz not null default now()
);
create index excecao_job_idx on public.excecao (job_id);
create index excecao_pendente_idx on public.excecao (criado_em) where aprovada is null;

-- ---------- Alerta (RF-52) ----------
create table public.alerta (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references public.job (id) on delete cascade,
  tipo         public.alerta_tipo not null,
  severidade   text not null default 'atencao' check (severidade in ('info', 'atencao', 'critico')),
  mensagem     text not null,
  resolvido    boolean not null default false,
  resolvido_por uuid references public.perfil (id),
  resolvido_em timestamptz,
  criado_em    timestamptz not null default now()
);
create unique index alerta_aberto_unico on public.alerta (job_id, tipo) where not resolvido;
create index alerta_aberto_idx on public.alerta (criado_em desc) where not resolvido;

-- ---------- Auditoria (RNF-12, RNF-04) ----------
create table public.auditoria (
  id            bigint generated always as identity primary key,
  usuario_id    uuid,
  usuario_email text,
  acao          text not null,
  entidade      text not null,
  entidade_id   text,
  dados         jsonb,
  criado_em     timestamptz not null default now()
);
create index auditoria_entidade_idx on public.auditoria (entidade, entidade_id);
create index auditoria_criado_idx on public.auditoria (criado_em desc);
create index auditoria_usuario_idx on public.auditoria (usuario_id, criado_em desc);

-- ---------- Consentimento / termo de ciência (seção 8) ----------
create table public.termo_ciencia (
  versao       text primary key,
  titulo       text not null,
  conteudo     text not null,
  vigente      boolean not null default false,
  publicado_em timestamptz not null default now()
);
create unique index termo_ciencia_vigente_unico on public.termo_ciencia (vigente) where vigente;

create table public.consentimento (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.perfil (id) on delete cascade,
  versao_termo text not null references public.termo_ciencia (versao),
  aceito_em    timestamptz not null default now(),
  user_agent   text,
  unique (usuario_id, versao_termo)
);

insert into public.termo_ciencia (versao, titulo, conteudo, vigente) values (
  '1.0',
  'Termo de Ciência — Coleta de Localização em Eventos do Job',
  'Declaro estar ciente de que o aplicativo Fast Mídia Tools captura a minha localização geográfica '
  || 'exclusivamente nos eventos de check-in (chegada), check-out (saída) e registro de corrida de transporte, '
  || 'com o aplicativo aberto e dentro da janela do job, com a finalidade de comprovar presença no cliente e '
  || 'validar corridas de 99. Nenhuma captura ocorre fora do expediente ou em segundo plano. Os eventos são '
  || 'retidos por 90 dias e depois excluídos automaticamente. Somente Supervisora e Admin consultam posições, '
  || 'e cada consulta é registrada. Posso solicitar acesso, correção ou contestação de um registro pelo canal do DPO. '
  || 'Este termo não substitui a política de privacidade e o RIPD aprovados pelo jurídico/DPO da Vanguarda.',
  true
);

-- ---------- Fila de integração / outbox (RNF-07, RNF-08) ----------
create table public.fila_integracao (
  id                 bigint generated always as identity primary key,
  tipo               public.integracao_tipo not null,
  chave_idempotencia text not null unique,
  payload            jsonb not null,
  status             public.integracao_status not null default 'pendente',
  tentativas         integer not null default 0,
  max_tentativas     integer not null default 5,
  proximo_em         timestamptz not null default now(),
  ultimo_erro        text,
  resultado          jsonb,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
comment on table public.fila_integracao is 'Outbox idempotente para Notion, Calendar/Drive (Apps Script), WhatsApp, e-mail e push. Processada pelo worker autenticado.';
create index fila_integracao_pendente_idx on public.fila_integracao (proximo_em) where status in ('pendente', 'erro');
create trigger fila_integracao_atualizado_em before update on public.fila_integracao
  for each row execute function public.tg_atualizado_em();
