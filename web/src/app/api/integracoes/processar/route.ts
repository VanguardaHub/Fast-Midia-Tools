import { NextResponse } from "next/server";
import { processarFila } from "@/lib/integracoes/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Worker da fila de integrações. Chamado pelo Vercel Cron (Authorization: Bearer CRON_SECRET)
 * ou manualmente pela gestão com o mesmo segredo. RF-63: endpoint autenticado por segredo.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  try {
    const r = await processarFila();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
