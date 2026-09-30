import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { fmtDataHora } from "@/lib/formato";
import { FormPerfil } from "./form-perfil";
import { FormSenha } from "./form-senha";

export const metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const s = await obterSessao();
  const supabase = await criarClienteServidor();
  const [{ data: consentimentos }, { data: consultas }] = await Promise.all([
    supabase.from("consentimento").select("versao_termo, aceito_em").eq("usuario_id", s.usuarioId).order("aceito_em", { ascending: false }),
    // QA P1 #2 — RPC security definer: a RLS de auditoria só libera as linhas do próprio usuário, e as consultas são da gestão
    s.fastId
      ? supabase.rpc("minhas_consultas_posicao", { p_limite: 30 })
      : Promise.resolve({ data: [] as { criado_em: string; usuario_email: string | null; entidade: string; referencia: string | null }[] }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Minha conta</h1>
      <FormPerfil nome={s.perfil.nome} telefone={s.perfil.telefone ?? ""} email={s.email} perfil={s.perfil.perfil} />
      <FormSenha />

      <section className="card space-y-2">
        <h2 className="font-semibold">Termo de ciência</h2>
        {consentimentos?.length ? (
          <ul className="text-sm text-muted">
            {consentimentos.map((c) => (
              <li key={c.versao_termo}>Versão {c.versao_termo} · aceito em {fmtDataHora(c.aceito_em)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhum termo aceito ainda.</p>
        )}
      </section>

      {s.fastId && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Quem consultou minha posição</h2>
          <p className="text-xs text-muted">Transparência (seção 8): cada consulta da gestão ao mapa ou ao seu histórico é registrada.</p>
          {consultas?.length ? (
            <ul className="divide-y divide-border text-sm">
              {consultas.map((c, i) => (
                <li key={i} className="flex justify-between py-1.5">
                  <span>{c.usuario_email ?? "sistema"}</span>
                  <span className="text-muted">{c.entidade === "job" ? `job ${c.referencia ?? ""}` : c.referencia ?? c.entidade} · {fmtDataHora(c.criado_em)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhuma consulta registrada.</p>
          )}
        </section>
      )}
    </div>
  );
}
