import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas sem sessão de usuário. /api/integracoes é protegida por CRON_SECRET no próprio handler (RF-63).
const ROTAS_PUBLICAS = ["/login", "/auth", "/api/integracoes", "/manifest.webmanifest", "/sw.js", "/icons", "/offline"];

/**
 * Proxy (Next 16): renova a sessão Supabase em cada requisição e
 * redireciona usuários não autenticados (RF-01 — nenhum endpoint público).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publica = ROTAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (publica && pathname !== "/login") return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims valida o JWT localmente (sem round-trip) e mantém a sessão renovada.
  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims);

  if (!autenticado && pathname !== "/login") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (autenticado && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
