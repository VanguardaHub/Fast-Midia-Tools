"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alterarPerfilUsuario, atualizarDadosPerfil, criarConvite, reenviarConvite, type ResultadoEnvioConvite } from "@/lib/actions/cadastros";

type P = "fast" | "analista" | "supervisora" | "admin";

function ResultadoConvite({ r }: { r: ResultadoEnvioConvite }) {
  const [copiado, setCopiado] = useState(false);
  if (!r.ok) return <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{r.erro}</p>;
  return (
    <div className="space-y-2 rounded-xl bg-success/10 p-3 text-sm">
      <p className="font-medium text-success">{r.emailEnviado ? "Convite enviado por e-mail." : "Link de acesso gerado."}</p>
      {r.aviso && <p className="text-warning">{r.aviso}</p>}
      <p className="text-muted">Link de uso único (também pode ser enviado por WhatsApp):</p>
      <div className="flex gap-2">
        <input className="input min-h-9 font-mono text-xs" readOnly value={r.link} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn-outline min-h-9 shrink-0 text-xs" onClick={async () => { try { await navigator.clipboard.writeText(r.link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch {} }}>
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export function FormConvite({ ehAdmin }: { ehAdmin: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<P>("analista");
  const [resultado, setResultado] = useState<ResultadoEnvioConvite | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setResultado(null);
        iniciar(async () => {
          const r = await criarConvite({ email, nome, perfil });
          setResultado(r);
          if (r.ok) { setEmail(""); setNome(""); router.refresh(); }
        });
      }}
    >
      <h2 className="font-semibold">Convidar acesso</h2>
      <div><label className="label">E-mail</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
      <div>
        <label className="label">Perfil</label>
        <select className="input" value={perfil} onChange={(e) => setPerfil(e.target.value as P)}>
          <option value="fast">Fast</option>
          <option value="analista">Analista</option>
          {ehAdmin && <option value="supervisora">Supervisora</option>}
          {ehAdmin && <option value="admin">Admin</option>}
        </select>
      </div>
      {resultado && <ResultadoConvite r={resultado} />}
      <button className="btn-primary w-full" disabled={pendente}>{pendente ? "Enviando…" : "Convidar e enviar link"}</button>
      <p className="text-xs text-muted">Para Fasts, prefira cadastrar em Cadastros → Fasts com o e-mail do calendário e depois convidar aqui com o mesmo e-mail.</p>
    </form>
  );
}

export function BotaoReenviar({ email }: { email: string }) {
  const [resultado, setResultado] = useState<ResultadoEnvioConvite | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="space-y-1">
      <button type="button" className="text-xs text-primary underline" disabled={pendente} onClick={() => iniciar(async () => setResultado(await reenviarConvite(email)))}>
        {pendente ? "gerando…" : "reenviar"}
      </button>
      {resultado && <ResultadoConvite r={resultado} />}
    </div>
  );
}

export function LinhaPerfil({ perfil, podeEditar }: { perfil: { id: string; nome: string; email: string; telefone: string; perfil: P; ativo: boolean }; podeEditar: boolean }) {
  const router = useRouter();
  const [p, setP] = useState<P>(perfil.perfil);
  const [ativo, setAtivo] = useState(perfil.ativo);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(perfil.nome);
  const [telefone, setTelefone] = useState(perfil.telefone);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  function salvar(np: P, na: boolean) {
    setP(np); setAtivo(na); setErro(null);
    iniciar(async () => {
      const r = await alterarPerfilUsuario(perfil.id, np, na);
      if (!r.ok) setErro(r.erro);
      router.refresh();
    });
  }
  function salvarDados() {
    setErro(null);
    iniciar(async () => {
      const r = await atualizarDadosPerfil(perfil.id, { nome, telefone });
      if (!r.ok) { setErro(r.erro); return; }
      setEditando(false);
      router.refresh();
    });
  }
  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-2">
        {editando ? <input className="input min-h-9 text-xs" value={nome} onChange={(e) => setNome(e.target.value)} /> : perfil.nome}
        {erro && <p className="text-xs text-danger">{erro}</p>}
      </td>
      <td className="p-2">{perfil.email}</td>
      <td className="p-2">{editando ? <input className="input min-h-9 w-36 text-xs" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="5592999999999" /> : perfil.telefone || "—"}</td>
      <td className="p-2">
        {podeEditar ? (
          <select className="input min-h-9 text-xs" value={p} disabled={pendente} onChange={(e) => salvar(e.target.value as P, ativo)}>
            <option value="fast">fast</option><option value="analista">analista</option><option value="supervisora">supervisora</option><option value="admin">admin</option>
          </select>
        ) : p}
      </td>
      <td className="p-2">{podeEditar ? <input type="checkbox" className="size-5" checked={ativo} disabled={pendente} onChange={(e) => salvar(p, e.target.checked)} /> : ativo ? "sim" : "não"}</td>
      <td className="p-2 text-right">
        {podeEditar && (editando ? (
          <span className="flex justify-end gap-1">
            <button type="button" className="btn-outline min-h-8 px-2 text-xs" disabled={pendente} onClick={() => { setEditando(false); setNome(perfil.nome); setTelefone(perfil.telefone); }}>Cancelar</button>
            <button type="button" className="btn-primary min-h-8 px-2 text-xs" disabled={pendente} onClick={salvarDados}>{pendente ? "Salvando…" : "Salvar"}</button>
          </span>
        ) : (
          <button type="button" className="btn-outline min-h-8 px-2 text-xs" onClick={() => setEditando(true)}>Editar</button>
        ))}
      </td>
    </tr>
  );
}
