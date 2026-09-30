# ADR-0002 — Next.js 16 (App Router) como PWA único para campo e painel, hospedado no Vercel

**Status:** Aceito
**Contexto:** O escopo propõe PWA em React/TypeScript (7.1) para uma base única, instalável, com app nativo avaliado apenas na Fase 5.
**Decisão:** Um único app Next.js com rotas por perfil (`/campo` para Fasts; `/painel`, `/agenda`, `/jobs`, `/mapa`, `/alertas`, `/indicadores`, `/cadastros` para gestão/analistas). Server Components para dados, Server Actions para mutações (validação Zod), `proxy.ts` para sessão. Manifest e service worker mínimo para instalação e shell offline; fila offline em IndexedDB para check-in/out. MapLibre GL com tiles OpenStreetMap (sem chave). Deploy no Vercel, região `gru1`, cron para o worker de integrações.
**Consequências:** Uma base de código e um deploy; iOS mantém limitações de PWA (R6) — plano B com wrapper nativo na Fase 5. Push notifications ficam para fase posterior (contingência por e-mail).
