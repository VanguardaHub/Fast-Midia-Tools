import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { hojeISO } from "@/lib/formato";
import { GradeAgenda } from "./grade-agenda";
import { AoVivo } from "@/components/ao-vivo";
import { googleCalendarConfigurado } from "@/lib/integracoes/google-calendar";

export const metadata = { title: "Agenda" };

/**
 * RF-10 / RF-11 — grade semanal por Fast e slot, lida do sistema (fonte da verdade). Indisponibilidades
 * informadas pelo Fast no app aparecem como "indisponível" (decisão de 08/10/2026: a leitura do Google Calendar
 * pessoal saiu do escopo; o Calendar fica só como espelho opcional dos jobs, RF-62).
 */
export default async function AgendaPage(props: PageProps<"/agenda">) {
  const s = await obterSessao();
  const sp = await props.searchParams;
  const base = typeof sp.semana === "string" ? parseISO(sp.semana) : parseISO(hojeISO());
  const segunda = startOfWeek(base, { weekStartsOn: 1 });
  const dias = Array.from({ length: 6 }, (_, i) => format(addDays(segunda, i), "yyyy-MM-dd"));

  const supabase = await criarClienteServidor();
  const [{ data: fasts }, { data: jobs }, { data: clientes }, { data: indisponibilidades }] = await Promise.all([
    supabase.from("fast").select("id, nome, cor").eq("ativo", true).order("nome"),
    supabase
      .from("job")
      .select("id, codigo, fast_id, data, slot, status, cliente:cliente_id(nome)")
      .gte("data", dias[0])
      .lte("data", dias[dias.length - 1])
      .neq("status", "cancelado"),
    supabase.from("cliente").select("id, nome, grupo").eq("ativo", true).order("nome"),
    supabase.from("indisponibilidade").select("id, fast_id, data, slot, motivo").gte("data", dias[0]).lte("data", dias[dias.length - 1]),
  ]);

  const anterior = format(addDays(segunda, -7), "yyyy-MM-dd");
  const proxima = format(addDays(segunda, 7), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda <AoVivo tabelas={["job", "briefing", "indisponibilidade"]} canal="agenda" compacto /></h1>
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
        indisponibilidades={indisponibilidades ?? []}
        ehGestao={s.ehGestao}
      />
      <p className="text-xs text-muted">
        A agenda é a fonte da verdade. Slots marcados como “indisponível” foram informados pelo próprio Fast no app; a supervisora pode remover a marcação ou agendar mesmo assim, com motivo.
        {googleCalendarConfigurado() ? " Cada job é espelhado no Google Calendar do Fast como lembrete (RF-62)." : ""}
      </p>
    </div>
  );
}
