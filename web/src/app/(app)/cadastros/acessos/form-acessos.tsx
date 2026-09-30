"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alterarPerfilUsuario, criarConvite } from "@/lib/actions/cadastros";

type P = "fast" | "analista" | "supervisora" | "admin";

export function FormConvite({ ehAdmin }: { ehAdmin: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<P>("analista");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await criarConvite({ email, nome, perfil }); setMsg(r.ok ? "Convite registrado. A pessoa já pode entrar com esse e-mail." : r.erro); if (r.ok) { setEmail(""); setNome(""); router.refresh(); } }); }}>
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
      {msg && <p className="text-sm">{msg}</p>}
      <button className="btn-primary w-full" disabled={pendente}>Convidar</button>
    </form>
  );
}

export function LinhaPerfil({ perfil, podeEditar }: { perfil: { id: string; nome: string; email: string; perfil: P; ativo: boolean }; podeEditar: boolean }) {
  const router = useRouter();
  const [p, setP] = useState<P>(perfil.perfil);
  const [ativo, setAtivo] = useState(perfil.ativo);
  const [pendente, iniciar] = useTransition();
  function salvar(np: P, na: boolean) {
    setP(np); setAtivo(na);
    iniciar(async () => { await alterarPerfilUsuario(perfil.id, np, na); router.refresh(); });
  }
  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-2">{perfil.nome}</td>
      <td className="p-2">{perfil.email}</td>
      <td className="p-2">
        {podeEditar ? (
          <select className="input min-h-9 text-xs" value={p} disabled={pendente} onChange={(e) => salvar(e.target.value as P, ativo)}>
            <option value="fast">fast</option><option value="analista">analista</option><option value="supervisora">supervisora</option><option value="admin">admin</option>
          </select>
        ) : p}
      </td>
      <td className="p-2">{podeEditar ? <input type="checkbox" className="size-5" checked={ativo} disabled={pendente} onChange={(e) => salvar(p, e.target.checked)} /> : ativo ? "sim" : "não"}</td>
    </tr>
  );
}
