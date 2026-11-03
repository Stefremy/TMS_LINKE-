# Formulário partilhado de envio

## Plano e ficheiros

1. Contrato e cotações: `components/shipments/form/schema.ts`, `useShipmentQuote.ts`; testes `shipment-form-schema` e `shipment-form-quote`.
2. Interface: `ShipmentForm.tsx`, `ShipmentSummary.tsx`, `fields.tsx`, `steps/{Parties,Parcel,Service,Review}Step.tsx`, `ops/OpsOverridesPanel.tsx`.
3. Portal cliente: preservar `LegacyClientCreateGuia.tsx`; tornar `ClientCreateGuia.tsx` num wrapper do formulário partilhado.
4. Operações: preservar `LegacyNovoEnvioPageClient.tsx`; tornar `NovoEnvioPageClient.tsx` num seletor de cliente e wrapper do formulário partilhado.
5. Servidor: `app/actions/shipment-form.ts` valida os campos e chama `emitClientGuiaAction`. `shipment-form-authorization.ts` rejeita campos Ops enviados por clientes, incluindo chamadas diretas à ação existente. Notas internas ficam num registo de auditoria separado dos dados públicos do envio.

## Condições mantidas

- O preço continua definido pela tabela e pelas condições de cada cliente, confirmado no servidor. Após esclarecimento com o utilizador, não há preço manual por envio.
- Os calculadores, as regras de destino, as tarifas e as reservas financeiras não são alterados.
- A escolha de transportadora Ops filtra serviços configurados; não substitui credenciais nem rotas.
- As taxas no painel Ops são de consulta. As condições comerciais continuam na ficha do cliente.
- Os formulários antigos são preservados até confirmação explícita do utilizador.
- Não emitir envios reais durante a verificação visual.

## Validação

Em cada fase: `npx tsc --noEmit`, lint dos ficheiros alterados, `npm run test:security`, `npm run test:finance`.
Testes específicos: `npm run test:shipment-form`.
A primeira passagem identificou fixtures antigas incompletas nos testes de reembolsos e rascunhos; foram atualizadas com estado, cobrança, datas e identificação de transportadora, sem alterar a lógica financeira de produção.

Resultado final: TypeScript sem erros; 16 testes específicos, 399 testes de segurança e 120 testes financeiros aprovados. O lint do formulário novo, wrappers, adaptador, componentes partilhados alterados e testes novos passa sem avisos. A execução abrangente ainda encontra 63 erros e 19 avisos preexistentes na ação de envios e nos corpos dos formulários legados; a comparação com `HEAD` confirmou a mesma contagem antes destas alterações.

Verificação no navegador: os três passos em cliente e Ops, validação e foco do primeiro campo inválido, preços por serviço, filtro de transportadora Ops, pesos individuais e resumo móvel a 390 px. Não houve emissão real; a resposta de sucesso e as proteções do servidor foram verificadas com testes isolados. As capturas estão em `output/screenshots/novo-envio-{cliente-servicos,ops-servicos,mobile-resumo}.jpg`.

Atualização de navegação: volumes, dimensões, serviço, opções de entrega e COD estão juntos no passo 2; revisão no passo 3. O cálculo e as condições de cada cliente mantêm-se.
