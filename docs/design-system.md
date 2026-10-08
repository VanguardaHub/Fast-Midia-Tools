# Design system — Fast Mídia Tools

**Versão:** 1.0 · **Data:** 08/10/2026 · **Decisão:** gerência do projeto ("use a paleta de cores da Vanguarda").
**Fonte da paleta:** identidade visual pública da Vanguarda Martech (site institucional e ícone da marca: "V" vermelho `#D03134`/`#D0323A` sobre branco; texto-base `#010A0E`). Não há manual de marca formal no repositório; se a agência fornecer um, este documento é atualizado e os tokens em `web/src/app/globals.css` são a única fonte a alterar.

## 1. Princípios

| # | Princípio | Como se aplica |
|---|---|---|
| 1 | **Uma marca, uma cor de ação** | O vermelho Vanguarda é a cor de ação primária (botões, links, item ativo). Não se usa roxo ou outras cores de marca. |
| 2 | **Campo primeiro (RNF-09)** | Alvos de toque ≥ 48 px, uma coluna no celular, botões de largura total nas telas do Fast. |
| 3 | **Contraste AA** | Texto normal ≥ 4,5:1 nos dois temas. Os tokens já foram calculados para isso (seção 2). |
| 4 | **Semântica estável** | Sucesso, aviso, erro e informação não mudam com a marca. Erro é um vermelho mais escuro e sempre vem com texto, nunca só cor. |
| 5 | **Tokens, não valores** | Componentes usam `bg-brand`, `text-primary`, `border-border` etc. Valores hexadecimais só existem em `globals.css`, no manifesto, nos ícones e no e-mail de convite. |

## 2. Tokens de cor

### Marca (iguais nos dois temas)

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--brand` | `#D03134` | fundo de botão primário, faixa da tela de login, ícone do app, cor do tema do PWA | branco sobre ele: 5,0:1 |
| `--brand-hover` | `#B42A2D` | hover/pressionado do botão primário | — |
| `--brand-foreground` | `#FFFFFF` | texto sobre `--brand` | — |
| `--brand-dark` | `#010A0E` | preto institucional (reservado a peças de marca) | — |

### Tema claro

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#F6F6F7` | fundo da página |
| `--foreground` | `#0B1014` | texto principal |
| `--card` | `#FFFFFF` | cartões, cabeçalho, inputs |
| `--muted` | `#5F6771` | texto secundário, rótulos (5,9:1 em branco) |
| `--border` | `#E3E5E9` | bordas e divisores |
| `--primary` | `#C92D30` | links, item de navegação ativo, badges de "em gravação" (5,3:1 em branco) |
| `--accent` | `#7A1F22` | vinho: status "em edição" e destaques secundários |
| `--success` / `--warning` / `--danger` / `--info` | `#15803D` / `#B45309` / `#991B1B` / `#0369A1` | semânticas |

### Tema escuro (`prefers-color-scheme: dark`)

| Token | Valor | Observação |
|---|---|---|
| `--background` / `--card` | `#0B0D10` / `#15181D` | derivados do preto institucional |
| `--foreground` / `--muted` / `--border` | `#F3F4F6` / `#9AA3AD` / `#272C34` | |
| `--primary` | `#FF6B6F` | vermelho clareado para texto (6,3:1 sobre o card); o botão primário continua `--brand` |
| `--accent` | `#F08A8D` | |
| semânticas | `#4ADE80` / `#FBBF24` / `#F87171` / `#38BDF8` | |

Por que dois vermelhos: `#D03134` como **texto** sobre fundo escuro fica em 3,5:1 (reprova AA). Por isso o botão usa `--brand` (fundo) e o texto usa `--primary` (ajustado por tema).

## 3. Tipografia e forma

- Fonte: Geist Sans (texto) e Geist Mono (códigos, IDs). Tamanho base 16 px; títulos de página `text-xl font-bold`; rótulos `text-sm font-medium text-muted`.
- Raio: cartões `rounded-2xl`, botões e inputs `rounded-xl`, badges `rounded-full`.
- Sombra: só `shadow-sm` em cartões. Sem gradientes.
- Foco: anel de 2 px na cor `--primary` (`:focus-visible`) e halo `--ring` nos inputs.

## 4. Componentes (classes em `globals.css`)

| Classe | Uso | Regra |
|---|---|---|
| `.btn-primary` | ação principal da tela (Entrar, Salvar, Registrar chegada) | uma por tela/bloco |
| `.btn-outline` | ações secundárias e **Entrar com o Google** (fundo branco + logotipo "G" oficial, conforme diretriz do Google) | |
| `.btn-danger` | ações destrutivas (cancelar job, remover) | contorno vermelho escuro; preenche só no hover, para não competir com o botão de marca |
| `.input`, `.label` | formulários | altura mínima 48 px |
| `.card` | agrupamento de conteúdo | |
| `.badge` + `STATUS_COR` (`lib/formato.ts`) | status de job e alertas | cores semânticas, nunca `brand` |
| `.divisor` | separador com texto ("ou com e-mail e senha") | |

## 5. Tela de login (tela inicial)

Ordem dos elementos: faixa `--brand` no topo do cartão → ícone + nome do app + "Vanguarda Martech · acesso corporativo" → **Entrar com o Google** → divisor → e-mail e senha → **Entrar** → orientação de primeiro acesso → aviso de privacidade.

- O botão Google aparece quando `NEXT_PUBLIC_AUTH_GOOGLE=true` (ativado em 08/10/2026). O fluxo é `signInWithOAuth` do Supabase Auth com `prompt=select_account`; o retorno passa por `/auth/callback`.
- Quem pode entrar pelo Google: e-mails do domínio `vanguardamartech.com.br`, convidados em Cadastros → Acessos ou cadastrados como Fast (`email_calendario`). Qualquer outro e-mail é recusado pelo banco (gatilho `auth_usuario_validar`) e a tela mostra "Este e-mail não está autorizado…".
- Pré-requisitos de infraestrutura (feitos): provedor Google habilitado no Supabase Auth com o cliente OAuth `38179161838-…`; URI `https://wcidhqxkoltwfrlairqj.supabase.co/auth/v1/callback` autorizado no Google Cloud.

## 6. Ícones e PWA

- `public/icons/icon-192.svg` e `icon-512.svg`: fundo `#D03134`, símbolo branco, detalhe `#FFD7D8`.
- `manifest.ts`: `theme_color #D03134`, `background_color #F6F6F7`. `layout.tsx`: `themeColor #D03134` (barra do navegador).
- Pendência (QA P2): gerar PNGs 180/192/512 para iOS, que não lê ícone SVG no "Adicionar à tela de início".

## 7. Onde a cor da marca aparece fora do CSS

| Local | Valor | Motivo |
|---|---|---|
| `components/mapa.tsx` | `#D03134` | geofence e marcador padrão (MapLibre não lê tokens CSS) |
| `lib/integracoes/convites.ts` | `#D03134` | e-mail HTML de convite (clientes de e-mail não carregam CSS externo) |
| `cadastros/fasts/form-fast.tsx` | `#D03134` | cor padrão de um Fast novo; cada Fast pode ter a sua |

## 8. Checklist de revisão de interface

- [ ] Nenhum hexadecimal novo fora dos lugares da seção 7.
- [ ] Botão primário único por bloco; destrutivo em `.btn-danger`.
- [ ] Toque ≥ 48 px e largura total no celular.
- [ ] Mensagens de erro com texto (não só cor) e `role="alert"`.
- [ ] Conferir nos dois temas (claro/escuro) antes de abrir o PR.
