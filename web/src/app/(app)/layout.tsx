import { obterSessao } from "@/lib/sessao";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const sessao = await obterSessao();
  return <Shell sessao={sessao}>{children}</Shell>;
}
