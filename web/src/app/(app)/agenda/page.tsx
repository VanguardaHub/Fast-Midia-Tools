import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { hojeISO } from "@/lib/formato";
import { GradeAgenda } from "./grade-agenda";

export const metadata = { title: "Agenda" };

/** RF-10 / RF-11 — grade semanal por Fast e slot; criação de job com regras aplicadas pelo banco. */
export default async function AgendaPage(props: PageProps<"/agenda">) {
  const s = await obterSessao();
  const sp = await props.searchParams;
  const base = typeof sp.semana === "string" ? parseISO(sp.semana) : parseISO(hojeISO());
  const segunda = startOfWeek(base, { weekStartsOn: 1 });
  const dias = Array.from({ length: 6 }, (_, i) => format(addDays(segunda, i), "yyyy-MM-dd"));

  const supabase = await criarClienteServidor();
  const [{ data: fasts }, { data: jobs }, { data: clientes }, disponibilidade] = await Promise.all([
    supabase.from("fast").select("id, nome, cor").eq("ativo", true).order("nome"),
    supabase
      .from("job")
      .select("id, codigo, fast_id, data, slot, status, cliente:cliente_id(nome)")
      .gte("data", dias[0])
      .lte("data", dias[dias.length - 1])
      .neq("status", "cancelado"),
    supabase.from("cliente").select("id, nome, grupo").eq("ativo", true).order("nome"),
    carregarBloqueiosCalendar(dias[0], dias[dias.length - 1]),
  ]);

  const anterior = format(addDays(segunda, -7), "yyyy-MM-dd");
  const proxima = format(addDays(segunda, 7), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
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
        Ocupação lida do banco (fonte da verdade). Bloqueios externos do Google Calendar aparecem quando o serviço interno do Apps Script está configurado (RF-10, RF-62).
      </p>
    </div>
  );
}

/** Integração opcional com o Apps Script (serviço interno de Calendar) — degrada graciosamente (RNF-07). */
async function carregarBloqueiosCalendar(inicio: string, fim: string): Promise<{ fast_email: string; data: string; slot: "manha" | "tarde" }[]> {
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
