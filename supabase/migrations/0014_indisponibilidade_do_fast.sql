-- ============================================================
-- Fast Mídia Tools 2.0 — Migração 0014: indisponibilidade informada pelo Fast (RF-10 reinterpretado)
-- Decisão de 08/10/2026 (gerência): a agenda do sistema é a fonte da verdade; a leitura do Google Calendar
-- pessoal do Fast sai do escopo. O Fast informa no app os dias/slots em que não pode gravar; a agenda mostra
-- "indisponível" e o banco recusa job nesse slot (gestão pode aprovar com motivo, como nos demais conflitos).
-- ============================================================

create table public.indisponibilidade (
  id         uuid primary key default gen_random_uuid(),
  fast_id    uuid not null references public.fast (id) on delete cascade,
  data       date not null,
  slot       public.slot_tipo,                -- null = dia inteiro
  motivo     text,                            -- opcional; o Fast não precisa justificar (RIPD: minimização)
  criado_por uuid default auth.uid() references public.perfil (id),
  criado_em  timestamptz not null default now()
);
comment on table public.indisponibilidade is 'Dias/slots em que o Fast informou não poder gravar (substitui a leitura do calendário pessoal). Motivo opcional.';
create unique index indisponibilidade_unica on public.indisponibilidade (fast_id, data, slot) where slot is not null;
create unique index indisponibilidade_unica_dia on public.indisponibilidade (fast_id, data) where slot is null;
create index indisponibilidade_data_idx on public.indisponibilidade (data);

alter table public.indisponibilidade enable row level security;
create policy indisponibilidade_select on public.indisponibilidade for select to authenticated
  using ((select public.eh_gestao()) or fast_id = (select public.auth_fast_id()) or (select public.auth_perfil()) = 'analista');
create policy indisponibilidade_insert on public.indisponibilidade for insert to authenticated
  with check ((select public.eh_gestao()) or fast_id = (select public.auth_fast_id()));
create policy indisponibilidade_delete on public.indisponibilidade for delete to authenticated
  using ((select public.eh_gestao()) or fast_id = (select public.auth_fast_id()));

-- Não marcar indisponível por cima de um job já agendado (quem reagenda é a gestão)
create or replace function public.tg_indisponibilidade_validar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_job public.job%rowtype;
begin
  if coalesce(new.motivo, '') = '' then new.motivo := null; end if;
  select * into v_job from public.job j
   where j.fast_id = new.fast_id and j.data = new.data and j.status <> 'cancelado'
     and (new.slot is null or j.slot = new.slot) limit 1;
  if v_job.id is not null then
    raise exception 'JOB_JA_AGENDADO: há o job #% neste dia/slot; peça à supervisão para reagendar', v_job.codigo using errcode = 'P0015';
  end if;
  return new;
end $$;
create trigger indisponibilidade_validar before insert on public.indisponibilidade
  for each row execute function public.tg_indisponibilidade_validar();

-- Agendamento sobre indisponibilidade: recusado, salvo gestão com motivo (mesma regra dos conflitos RF-12/RF-13)
create or replace function public.tg_job_indisponibilidade() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ind public.indisponibilidade%rowtype;
begin
  if new.status = 'cancelado' then return new; end if;
  if tg_op = 'INSERT' or new.data <> old.data or new.slot <> old.slot or new.fast_id <> old.fast_id or old.status = 'cancelado' then
    select * into v_ind from public.indisponibilidade i
     where i.fast_id = new.fast_id and i.data = new.data and (i.slot is null or i.slot = new.slot) limit 1;
    if v_ind.id is not null and not ((public.eh_gestao() or public.eh_sistema()) and coalesce(new.excecao_motivo, '') <> '') then
      raise exception 'FAST_INDISPONIVEL: o Fast informou indisponibilidade em % (%). Requer aprovação da supervisora com motivo.',
        new.data, coalesce(v_ind.slot::text, 'dia inteiro') using errcode = 'P0014';
    end if;
  end if;
  return new;
end $$;
create trigger job_indisponibilidade before insert or update on public.job
  for each row execute function public.tg_job_indisponibilidade();

alter publication supabase_realtime add table public.indisponibilidade;
