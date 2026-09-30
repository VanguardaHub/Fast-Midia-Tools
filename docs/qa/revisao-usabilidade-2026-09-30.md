# Revisão geral de usabilidade (QA) — Fast Mídia Tools 2.0

**Data:** 30/09/2026 · **Ambiente:** produção (`fast-midia-tools.vercel.app`, `main` em 164cf5a) · **Método:** navegação por todas as rotas com perfil Admin (25 rotas), leitura dos fluxos de campo no código (perfil Fast não pôde ser exercitado num aparelho real) e cruzamento com o escopo (RF/RNF) e as ADRs.

## 1. Resumo executivo

A plataforma está funcional de ponta a ponta para a gestão: nenhuma rota devolveu erro de aplicação, os estados vazios têm texto orientador e as regras de negócio críticas ficam no banco. Os problemas encontrados são de **consistência de feedback e de fechamento de ciclo**, não de arquitetura. Três merecem correção antes do piloto com os Fasts (P1); o restante é polimento (P2/P3).

| Prioridade | Qtde | Exemplos |
|---|---|---|
| P1 — corrigir antes do piloto | 4 | alerta de atraso volta após ser resolvido; Fast não consegue ver quem consultou sua posição; páginas 404/erro sem identidade e em inglês; contagem de "convites pendentes" inconsistente |
| P2 — próxima iteração | 7 | "Resolvido por —" para resolução automática; título da aba no detalhe do job; gestão forçada a aceitar o termo ao abrir /campo; auditoria com ids truncados e JSON bruto; sem "esqueci a senha" autônomo; Kanban sem confirmação ao mover; agenda sem aviso de Fast sem login |
| P3 — melhoria contínua | 5 | indicador "conectando" sem tooltip no celular; texto "Ocupação lida do banco…" técnico para a supervisora; ausência de atalhos de teclado/foco visível; ícones SVG do PWA no iOS; contraste dos badges em modo escuro |

## 2. O que foi verificado e está adequado

- **Navegação e sessão:** redirecionamentos corretos (`/` → `/painel` para gestão; rotas de API sem sessão devolvem 401; páginas → `/login?next=`). Menu inferior no celular e superior no desktop.
- **Estados vazios:** todas as listas têm mensagem orientadora ("Nenhum job hoje", "Nenhum Fast cadastrado. Use o formulário ao lado").
- **Cadastros:** criar, editar, desativar, excluir (Admin, sem jobs) e vincular conta de login; mensagens específicas para duplicidade.
- **Alertas:** seção de resolvidos com autor e data, botão Reabrir.
- **Mapa do dia:** consulta auditada e agrupada; posição ao vivo entre check-in e check-out (validado por simulação no banco e renderização em produção).
- **Segurança de UX:** ações destrutivas (cancelar job, excluir cadastro) pedem confirmação; regras P0002–P0013 traduzidas para português.
- **PWA:** manifesto válido, página offline com explicação da fila.

## 3. Achados

### P1 — corrigir antes do piloto

| # | Tela | Achado | Evidência | Impacto | Correção proposta |
|---|---|---|---|---|---|
| 1 | Alertas | Ao resolver "Check-in atrasado", o cron recria o mesmo alerta em até 10 min enquanto o check-in não acontece. A supervisora resolve e o alerta "volta". | Job #5 teve 3 alertas de atraso resolvidos entre 14:45 e 15:00 | Desconfiança no botão Resolver; ruído no painel | Em `gerar_alertas_periodicos`, não recriar alerta de um tipo já resolvido manualmente para o mesmo job (ou só recriar após N horas). Migração pequena. |
| 2 | Minha conta (Fast) | "Quem consultou minha posição" nunca mostra nada para o Fast: a RLS de `auditoria` só libera linhas do próprio usuário, e as consultas são feitas pela gestão. | Política `auditoria_select` (0006) + `conta/page.tsx` | Quebra a promessa de transparência do termo (seção 8, RNF-04) | RPC `minhas_consultas_posicao()` (security definer) filtrando `dados->>'fast_id'` do Fast logado; página passa a usá-la. |
| 3 | Rotas inexistentes / job inexistente | 404 padrão do Next em inglês ("This page could not be found"); job inexistente renderiza página em branco só com o cabeçalho. | `/rota-inexistente`, `/jobs/0000…` | Sensação de sistema quebrado; sem caminho de volta | `app/not-found.tsx` e `app/error.tsx` com identidade, texto em pt-BR e botão "Voltar ao painel". |
| 4 | Cadastros (índice) e Acessos | Índice diz "2 convite(s) pendente(s)", mas ambas as contas já existem; em Acessos o mesmo convite aparece como "link não gerado". A marcação `usado_em` só é gravada quando a conta nasce pelo gatilho de domínio, não pelo link de convite do Admin. | `/cadastros` e `/cadastros/acessos` | Supervisora não sabe se precisa reenviar | Marcar `usado_em` no `auth/confirmar` (ou por gatilho em `auth.users` para qualquer e-mail com convite); rótulo "aguardando primeiro acesso" em vez de "link não gerado". |

### P2 — próxima iteração

| # | Tela | Achado | Correção proposta |
|---|---|---|---|
| 5 | Alertas | "Resolvido por —" quando o próprio sistema resolveu (check-in feito). | Exibir "sistema (check-in registrado)" quando `resolvido_por` é nulo. |
| 6 | Detalhe do job | Título da aba é só "Fast Mídia Tools"; nas demais telas é "Página · Fast Mídia Tools". | `generateMetadata` com "Job #5 · CAA". |
| 7 | /campo (gestão) | Admin/Supervisora que abre "Hoje" é redirecionado ao termo de ciência, que não se aplica a quem não é Fast. | Pular o redirecionamento quando `ehGestao`, como já faz `/campo/jobs/[id]`. |
| 8 | Auditoria | `entidade_id` cortado em 8 caracteres corta datas ("2026-09-"); `dados` em JSON bruto. | Cortar só UUIDs; renderizar diffs "campo: de → para". |
| 9 | Login | Não há "esqueci minha senha" autônomo; o texto manda pedir link à supervisão. Aceitável no piloto, mas gera chamados. | Ativar recuperação por e-mail quando o Resend/SMTP do Supabase estiver configurado. |
| 10 | Kanban | "Mover para…" muda o status sem confirmação; mover para "Cancelado" exige motivo e falha com mensagem genérica. | Confirmar a transição; para "Cancelado", abrir o diálogo de motivo do detalhe do job. |
| 11 | Agenda | É possível agendar um Fast "sem login"; o aviso só aparece no detalhe do job. | Badge "sem login" na linha do Fast na grade e aviso no formulário de novo job. |

### P3 — melhoria contínua

| # | Achado | Correção proposta |
|---|---|---|
| 12 | Indicador "conectando/ao vivo" não explica o que significa no celular (título só no hover). | Texto curto ao lado ou toque para abrir a explicação. |
| 13 | Texto técnico na agenda: "Ocupação lida do banco (fonte da verdade)…". | Reescrever para a supervisora: "A agenda mostra os jobs confirmados; bloqueios do Google Calendar aparecem quando a integração estiver ativa." |
| 14 | Foco de teclado pouco visível em botões `btn-outline`. | `focus-visible:ring`. |
| 15 | Ícones do PWA em SVG: iOS ignora e mostra captura da tela ao adicionar à tela inicial. | Gerar PNG 180/192/512 e `apple-touch-icon`. |
| 16 | Contraste de badges (`bg-warning/15 text-warning`) no modo escuro fica abaixo de 4,5:1 em alguns fundos. | Ajustar tokens de cor. |

## 4. Riscos e limitações desta revisão

- O fluxo do Fast (termo → check-in → posição ao vivo → check-out → comprovantes) foi validado por simulação no banco e leitura de código, não em aparelho. O piloto deve incluir a matriz de dispositivos do protocolo de pesquisa (Android/Chrome, iOS/Safari).
- Não foram testados: convite por e-mail (Resend pendente), integrações Notion/WhatsApp/Apps Script (credenciais pendentes) e comportamento offline real.

## 5. Plano de ação sugerido

| Item | Esforço | Responsável | Quando |
|---|---|---|---|
| P1 #1, #2, #4 (banco + página) | 1 migração + 3 arquivos | Dev | antes do piloto |
| P1 #3 (404/erro) | 2 arquivos | Dev | antes do piloto |
| P2 #5–#8 | pequenos | Dev | semana seguinte |
| P2 #9 | depende de SMTP/Resend | TI | quando credenciais chegarem |
| P2 #10–#11, P3 | incremental | Dev | ciclo 2 da pesquisa |

**Indicador de acompanhamento:** número de achados P1 abertos (meta 0 antes do piloto) e tempo médio de resolução de alertas sem reabertura (meta ≥ 95% sem recriação).
