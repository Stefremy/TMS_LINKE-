# Configuração dos domínios Toke — 15/10/2026

## Endereços

| Utilização | Endereço |
| --- | --- |
| Clientes | https://app.toke.pt/app/login |
| Loja (exemplo) | https://app.toke.pt/app/stef-store |
| Equipa | https://ops.toke.pt/login |
| Tracking público | https://www.toke.pt/tracking |
| Stripe | https://ops.toke.pt/api/webhooks/stripe |
| Moloni OAuth | https://ops.toke.pt/api/moloni/callback |
| CTT webhook (só se contratado/configurado) | https://ops.toke.pt/api/webhooks/ctt/tracking |

Os dois subdomínios usam o mesmo projeto `tms-linke`, na equipa `stefremys-projects`, e a mesma base de dados. Não criar outro projeto Supabase nem copiar utilizadores/lojas.

## DNS e Vercel

Em 15/10/2026, `toke.pt` e `www.toke.pt` já estavam associados ao TMS na Vercel; o domínio sem www redirecionava para www. `app.toke.pt` e `ops.toke.pt` foram adicionados ao mesmo projeto para Production.

Valores obtidos diretamente na configuração de cada subdomínio na Vercel:

| Tipo | Nome | Destino | TTL sugerido |
| --- | --- | --- | --- |
| CNAME | app.toke.pt | 60fc253c13612b91.vercel-dns-016.com. | 300 |
| CNAME | ops.toke.pt | 60fc253c13612b91.vercel-dns-016.com. | 300 |

A zona está em Domínios.pt → toke.pt → Ferramentas de Gestão → Gestão DNS. O editor desta conta usa nomes completos. Confirmar o estado dos dois registos antes de acrescentar para evitar duplicados. Manter os restantes registos. Verificar `Valid Configuration` na Vercel depois da propagação; confirmar HTTPS em ambos.

## Variáveis de ambiente de Production na Vercel

```dotenv
CLIENT_PORTAL_ORIGIN=https://app.toke.pt
OPS_ORIGIN=https://ops.toke.pt
PUBLIC_SITE_ORIGIN=https://www.toke.pt
```

Só alterar o endereço do portal nos convites quando o DNS e HTTPS estiverem válidos. Publicar as alterações de código e fazer novo deployment com estas variáveis. `.env.local` pertence apenas ao desenvolvimento; não foi substituído por valores de produção.

`CLIENT_PORTAL_ORIGIN` já é usado nos convites. `OPS_ORIGIN` e `PUBLIC_SITE_ORIGIN` são usados pelo novo encaminhamento, links de email e callback Moloni. Não partilhar cookies através de `.toke.pt` nem acrescentar permissões CORS/Server Actions para `*.toke.pt`: os formulários continuam no próprio domínio.

## Supabase Auth

Em Authentication → URL Configuration, definir Site URL para `https://app.toke.pt`. Permitir os destinos exatos utilizados pelo fluxo de autenticação, incluindo `https://app.toke.pt/app/ativar`, `https://app.toke.pt/app/login` e `https://ops.toke.pt/login`. Conservar os redirects localhost necessários aos testes locais.

O convite atual é um email Resend com um link direto para `/app/ativar#...`, gerado com `CLIENT_PORTAL_ORIGIN`; o token é verificado no endpoint do próprio portal. Alterar apenas o Site URL do Supabase não atualiza esses emails. Não publicar os tokens nem usar um convite real em testes automatizados.

## Stripe (depois de DNS, HTTPS e deployment)

Preferir editar o destino do webhook já usado por esta aplicação para `https://ops.toke.pt/api/webhooks/stripe`. Usar payload **Snapshot**, pois o handler lê `event.data.object` como Checkout Session. Os eventos tratados são:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

O handler só credita sessões com `payment_status=paid`. As credenciais de API não precisam de mudar por causa do domínio. Confirmar que `STRIPE_WEBHOOK_SECRET` na Vercel corresponde ao destino e modo efetivamente usados. Se criar um destino novo, o secret é próprio desse destino; a chave Stripe CLI local não serve como secret de produção. Evitar manter destinos duplicados a creditar a mesma conta. Não testar carregamentos reais nem reenviar eventos de pagamento reais apenas para verificar DNS.

## Emails

Manter um remetente Resend já verificado, se continuar disponível. Se mudar para `notificacoes@toke.pt`, verificar o domínio/remetente na Resend, criar os registos DNS exatos fornecidos e atualizar `STORE_FROM_EMAIL`. O domínio do website não obriga a mudar os endereços de email existentes da equipa. Os endereços `@linke.pt` não foram renomeados.

## Moloni e transportadoras

Registar no Moloni o callback exato `https://ops.toke.pt/api/moloni/callback`, igual ao gerado por `OPS_ORIGIN`. Só voltar a autorizar a ligação se necessário; não emitir documentos de teste reais.

Se os CTT enviarem eventos para o webhook desta aplicação, atualizar a URL registada para a indicada na tabela, mantendo a autenticação Bearer configurada com `CTT_WEBHOOK_SECRET`. Consultas de tracking por API e emissão de guias não requerem trocar as credenciais das transportadoras só por mudar o domínio do TMS.

## Comportamento e validação

- `app.toke.pt/` encaminha para `/app` e daí para o login/loja adequado.
- `/login` no domínio dos clientes abre `/app/login`.
- `/ops/...` no domínio dos clientes encaminha para o domínio Ops; os controlos de função continuam a negar acesso a clientes.
- `ops.toke.pt/` encaminha para `/ops`.
- A equipa pode continuar a abrir a interface de uma loja em `ops.toke.pt/app/<slug>`, mantendo a sessão e o contexto de operador nesse domínio.
- Os cookies de autenticação continuam restritos a cada host; entrar num domínio não inicia sessão automaticamente no outro.
- Pedidos POST não são redirecionados entre domínios; evita encaminhar palavras-passe e Server Actions para outro host.
- Localhost e URLs antigas da Vercel mantêm o comportamento anterior quando não coincidem com as origens configuradas.

Validação local: `node --test tests/domain-routing.test.cjs`, `npm run test:security`, `npx tsc --noEmit` e `npm run build`. Os testes não enviam emails, não emitem guias e não movimentam saldo real.

Fontes: [Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [Domínios.pt](https://kb.dominios.pt/article/como-apontar-o-dominio-para-o-site/), [Supabase](https://supabase.com/docs/guides/auth/redirect-urls), [Stripe](https://docs.stripe.com/webhooks), [Resend](https://resend.com/docs/dashboard/domains/introduction).
