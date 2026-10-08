-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0015: credencial OAuth das integrações Google (ADR-0006, revisão 2)
-- A conta Google corporativa (ex.: diana.savi@vanguardamartech.com.br) é conectada uma vez pelo Admin em
-- Cadastros → Integrações; o token de atualização fica nesta tabela, acessível SOMENTE ao service_role
-- (RLS ligada sem políticas). Calendar (espelho) e Drive (pasta de ingest) passam a agir como essa conta.
-- ============================================================
create table public.integracao_credencial (
  provedor      text primary key check (provedor in ('google')),
  conta_email   text not null,
  refresh_token text not null,
  escopos       text[] not null default '{}',
  conectado_por uuid references public.perfil (id),
  atualizado_em timestamptz not null default now()
);
comment on table public.integracao_credencial is 'Tokens de atualização OAuth das integrações. Sem políticas RLS: só o service_role (worker) lê e grava.';
alter table public.integracao_credencial enable row level security;
revoke all on public.integracao_credencial from anon, authenticated;
