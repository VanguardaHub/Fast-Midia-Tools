import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao";

export default async function Home() {
  const s = await obterSessao();
  if (s.ehGestao) redirect("/painel");
  if (s.perfil.perfil === "analista") redirect("/agenda");
  redirect("/campo");
}
