import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { hojeISO } from "@/lib/formato";
import { GradeAgenda } from "./grade-agenda";
import { AoVivo } from "@/components/ao-vivo";
import { carregarBloqueiosGoogle, googleCalendarConfigurado } from "@/lib/integracoes/google-calendar";
import type { Bloqueio, JanelaSlots } from "@/lib/integracoes/calendario-bloqueios";

export const metadata = { title: "Agenda" };

/** RF-10 / RF-11 — grade semanal por Fast e slot; criação de job com regras aplicadas pelo banco. */
export default async function AgendaPage(props: PageProps<"/agenda">) {
  const s = await obterSessao();
  const sp = await props.searchParams;
  const base = typeof sp.semana === "string" ? parseISO(sp.semana) : parseISO(hojeISO());
  const segunda = startOfWeek(base, { weekStartsOn: 1 });
  const dias = Array.from({ length: 6 }, (_, i) => format(addDays(segunda, i), "yyyy-MM-dd"));

  const supabase = await criarClienteServidor();
  const { data: fasts } = await supabase.from("fast").select("id, nome, cor, email_calendario").eq("ativo", true).order("nome");
  const [{ data: jobs }, { data: clientes }, disponibilidade] = await Promise.all([
    supabase
      .from("job")
      .select("id, codigo, fast_id, data, slot, status, cliente:cliente_id(nome)")
      .gte("data", dias[0])
      .lte("data", dias[dias.length - 1])
      .neq("status", "cancelado"),
    supabase.from("cliente").select("id, nome, grupo").eq("ativo", true).order("nome"),
    carregarBloqueiosCalendar(dias[0], dias[dias.length - 1], (fasts ?? []).map((f) => ({ email: f.email_calendario })), supabase),
  ]);
  const origemBloqueios = googleCalendarConfigurado() ? "Google Calendar" : process.env.APPS_SCRIPT_URL ? "Apps Script" : null;

  const anterior = format(addDays(segunda, -7), "yyyy-MM-dd");
  const proxima = format(addDays(segunda, 7), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda <AoVivo tabelas={["job", "briefing"]} canal="agenda" compacto /></h1>
          <p className="text-sm text-muted">
            Semana de {format(segunda, "dd/MM", { locale: ptBR })} a {format(addDays(segunda, 5), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/agenda?semana=${anterior}`} className="btn-outline">← Anterior</Link>
          <Link href="/agenda" className="btn-outline">Hoje</Link>
          <Link href={`/agenda?semana=${proxima}`} className="btn-outline">Próxima →</Link>
        </div>
      </header>

      <GradeAgenda
        dias={dias}
        fasts={fasts ?? []}
        jobs={(jobs ?? []).map((j) => ({ ...j, cliente: j.cliente?.nome ?? "" }))}
        clientes={clientes ?? []}
        bloqueios={disponibilidade}
        ehGestao={s.ehGestao}
      />
      <p className="text-xs text-muted">
        A agenda mostra os jobs confirmados no sistema.{" "}
        {origemBloqueios
          ? `Compromissos do ${origemBloqueios} de cada Fast aparecem como “ocupado” e não podem receber job (${disponibilidade.length} bloqueio(s) nesta semana).`
          : "Quando a integração com o Google Calendar estiver configurada, os compromissos de cada Fast aparecem como “ocupado”."}
        {" "}Cada job criado ou alterado é gravado no calendário do Fast (RF-62).
      </p>
    </div>
  );
}

/** Integração opcional com o Apps Script (serviço interno de Calendar) — degrada graciosamente (RNF-07). */
/** RF-10 — bloqueios externos: Google Calendar (API, ADR-0006) quando configurado; senão Apps Script; senão nenhum. */
async function carregarBloqueiosCalendar(inicio: string, fim: string, fasts: { email: string }[], supabase: Awaited<ReturnType<typeof criarClienteServidor>>): Promise<Bloqueio[]> {
  if (googleCalendarConfigurado()) {
    try {
      const { data: cfg } = await supabase.from("configuracao").select("valor").eq("chave", "slots").maybeSingle();
      const slots = (cfg?.valor as JanelaSlots | null) ?? undefined;
      return await carregarBloqueiosGoogle(fasts, inicio, fim, slots);
    } catch {
      return [];
    }
  }
  const url = process.env.APPS_SCRIPT_URL;
  const token = process.env.APPS_SCRIPT_TOKEN;
  if (!url || !token) return [];
  try {
    const r = await fetch(`${url}?acao=disponibilidade&inicio=${inicio}&fim=${fim}&token=${encodeURIComponent(token)}`, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const j = (await r.json()) as { bloqueios?: { fast_email: string; data: string; slot: "manha" | "tarde" }[] };
    return j.bloqueios ?? [];
  } catch {
    return [];
  }
}
