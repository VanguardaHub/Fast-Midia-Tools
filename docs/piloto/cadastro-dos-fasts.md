# Cadastro dos Fasts para o piloto — roteiro operacional

**Objetivo:** deixar cada Fast do piloto com cadastro, conta de login vinculada, termo 2.0 aceito e app instalado, em até 10 minutos por pessoa. Pré-requisito único: nome e e-mail corporativo de cada Fast.

## 1. Lista de Fasts (preencher)

| # | Nome | E-mail corporativo (login e Calendar) | WhatsApp (DDI+DDD+número) | Cor no mapa | Aparelho (Android/iOS) | Cadastrado | Convite enviado | Termo 2.0 aceito | App instalado |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Diana Savi | diana.savi@vanguardamartech.com.br | — | #7C3AED | [preencher] | ✅ | ✅ (conta criada) | ✅ | [ ] |
| 2 | | @vanguardamartech.com.br | | | | [ ] | [ ] | [ ] | [ ] |
| 3 | | @vanguardamartech.com.br | | | | [ ] | [ ] | [ ] | [ ] |
| 4 | | @vanguardamartech.com.br | | | | [ ] | [ ] | [ ] | [ ] |

Regras: e-mail no domínio `vanguardamartech.com.br` entra sem convite (login automático); e-mail de outro domínio precisa de convite **ou** de cadastro como Fast (o cadastro autoriza o e-mail). O e-mail do cadastro deve ser exatamente o do Google Calendar do Fast, porque é ele que recebe os eventos dos jobs.

## 2. Passo a passo por Fast (supervisora ou admin)

1. **Cadastros → Fasts → Novo Fast:** nome, e-mail, WhatsApp, cor. Deixe "Conta de login vinculada" vazia. Salvar.
2. **Cadastros → Acessos → Convidar acesso:** e-mail, nome, perfil **Fast** → Gerar. Copie o link (sem Resend o e-mail não é enviado automaticamente) e envie ao Fast por WhatsApp.
3. O Fast abre o link no **celular**: a conta é criada e vinculada ao cadastro pelo e-mail; ele aceita o **Termo de Ciência 2.0** e define a senha em **Minha conta**.
4. Confirme em **Cadastros → Fasts** que a coluna "Conta" mostra **vinculada**. Se ficar "sem login", use **Editar → Conta de login vinculada** e selecione a conta.
5. Na sessão de onboarding: instalar na tela inicial, permissões de localização (precisão alta) e câmera, leitura da política BYOD.

## 3. O que já está preparado no sistema

- Domínio corporativo liberado para login automático (`dominios_email_permitidos`).
- Termo 2.0 vigente; aceite exigido antes do primeiro check-in.
- Rastreio na gravação habilitado (`rastreio_habilitado`), com botão Pausar no app.
- Fast de teste ("teste", teste@teste.com.br) **desativado** em 30/09: não aparece mais na agenda nem nas listas; o job #4 de teste permanece no histórico.
- Diana Savi pronta: cadastro, conta vinculada e termo 2.0 aceito.

## 4. Depois do cadastro

- Agendar o primeiro job de cada Fast na **Agenda** (a geofence é definida pelo endereço automaticamente; confirmar no detalhe do job).
- Verificar em **Cadastros → Integrações** se o Google Calendar está "configurada"; se sim, o job aparece no calendário do Fast em até 10 minutos.
- Registrar no diário do piloto qualquer dificuldade de instalação ou permissão, por aparelho.
