import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";

export const metadata = { title: "Cadastros" };

export default async function CadastrosPage() {
  const s = await exigirGestao();
  const supabase = await criarClienteServidor();
  const [fasts, fastsSemLogin, clientes, perfis, convitesPendentes] = await Promise.all([
    supabase.from("fast").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("fast").select("id", { count: "exact", head: true }).eq("ativo", true).is("perfil_id", null),
    supabase.from("cliente").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("perfil").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("convite").select("email", { count: "exact", head: true }).is("primeiro_acesso_em", null),
  ]);

  const cards = [
    { href: "/cadastros/fasts", titulo: "Fasts", valor: fasts.count ?? 0, detalhe: `${fastsSemLogin.count ?? 0} ainda sem login`, desc: "Equipe de campo: nome, e-mail do calendário, WhatsApp e cor (RF-03)." },
    { href: "/cadastros/clientes", titulo: "Clientes", valor: clientes.count ?? 0, detalhe: "ativos", desc: "Clientes e pasta no Drive CRIAÇÃO/[ANO]/[CLIENTE] (RF-16)." },
    { href: "/cadastros/acessos", titulo: "Acessos", valor: perfis.count ?? 0, detalhe: `${convitesPendentes.count ?? 0} aguardando primeiro acesso`, desc: "Perfis Fast, Analista, Supervisora e Admin; convites (RF-01, RF-02)." },
  ];
  if (s.ehAdmin) {
    cards.push({ href: "/cadastros/configuracoes", titulo: "Configurações", valor: 0, detalhe: "", desc: "Buffer de 2h, raio da geofence, precisão, retenção e domínios de login." });
    cards.push({ href: "/cadastros/auditoria", titulo: "Auditoria", valor: 0, detalhe: "", desc: "Trilha de alterações e consultas de posição (RNF-12)." });
  }
  cards.push({ href: "/cadastros/integracoes", titulo: "Integrações", valor: 0, detalhe: "", desc: "Fila de Notion, Calendar/Drive, WhatsApp e e-mail (RNF-08)." });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cadastros</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card block hover:border-primary">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{c.titulo}</h2>
              {c.valor > 0 || c.detalhe ? <span className="text-2xl font-bold">{c.valor || ""}</span> : null}
            </div>
            {c.detalhe && <p className="text-xs text-muted">{c.detalhe}</p>}
            <p className="mt-2 text-sm text-muted">{c.desc}</p>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted">
        Passo inicial recomendado: cadastrar os Fasts com o e-mail do Google Calendar (é o e-mail com que eles entram no app), depois os clientes com a pasta do Drive, depois convidar analistas.
      </p>
    </div>
  );
}
