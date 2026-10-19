# Estudo do manual RecolhasWS V1.4

Data: 19/10/2026. Fonte: `CTT API/RecolhasWS_ V1 4.pdf`, edição de fevereiro de 2013, 28 páginas PDF. Leitura integral, incluindo o WSDL e os schemas do anexo.

## Conclusão para o problema dos contactos

O manual **não especifica que o contacto deva ser um telefone fixo**. Define campos de telefone obrigatórios e mensagens de validação de preenchimento/comprimento; não documenta uma regra que rejeite telemóveis. A ausência de uma regra no manual não garante, por si só, que todos os formatos sejam aceites pelo serviço atual.

O documento confirma a separação identificada pelo utilizador:

| Informação | Campos do método documentado | Aplicação no TMS |
| --- | --- | --- |
| Conta CTT | `NumCliente`, `NumContrato`, `ID` | Conta/contrato da Linke e chave GUID |
| Quem solicita | `SolicitadaPor`, `Contacto`, `Telefone`, `Email` | Contacto da Linke |
| Local da recolha | `Expedidor`, `ContactoExp`, `TelefoneExp`, morada e código postal `Exp` | Loja/local onde o estafeta recolhe |
| Destinatário dos objetos | Campos `Dest`, incluindo `TelefoneDest` opcional | Destino da mercadoria; não confundir com a loja onde se recolhe |

Referências: páginas impressas 6–7, páginas PDF 7–8. `Telefone` e `TelefoneExp` são obrigatórios. Não existe um campo separado `Telemovel` neste contrato antigo. Não se deve concluir que a falta desse campo proíba um número móvel em `Telefone`.

## O método deste PDF não é o método usado na marcação atual

O PDF descreve:

```text
MarcarRecolha(NumCliente, NumContrato, ID, recolhaData)
```

O código atual em `lib/services/ctt/ctt-pickup.service.ts` usa:

```text
NewOfferPickUp(Input)
```

| Aspeto | Manual V1.4 / MarcarRecolha | Implementação atual / NewOfferPickUp |
| --- | --- | --- |
| Autenticação | `NumCliente`, `NumContrato`, `ID` como parâmetros da operação | `AuthenticationID`, `ClientData.ClientID`, `ClientData.ContractID` |
| Namespace dos dados | `http://schemas.datacontract.org/2004/07/BusinessEntities` | `http://schemas.datacontract.org/2004/07/CTTExpressoWS.Models.PickUp` |
| Contacto do solicitante | `_Contacto`, `_Telefone` no XML | `ClientData.ContactName`, `ClientData.Phone` |
| Contacto do local | `_ContactoExp`, `_TelefoneExp` | `PickupAddress.Contact`, `PickupAddress.Phone`, `PickupAddress.MobilePhone` |
| Horário | `_HoraInicio`, `_HoraFim` | `PickUpPeriod` |
| Serviço | `_CodProduto`, obtido através de `GetProdutosRecolha` | Contrato distinto; não copiar automaticamente este campo |
| Quantidade e peso | `_QuantObj`, `_Peso` em gramas | `TotalObjects`, `TotalWeight` em gramas |
| Dimensões | `_Dimensao`, string opcional | Três campos numéricos de dimensões |
| Volume mais pesado | Não existe campo específico no V1.4 | `HeavierObjectWeight` |
| Sucesso | `_IDRecolha` preenchido | `Status` / `PickUpID` |
| Erros | `_erros` como lista de strings | `ErrorList` com códigos e mensagens |

Os nomes com prefixo `_` constam do schema do anexo. Não basta reutilizar os nomes das tabelas descritivas sem verificar a serialização. Referências: páginas PDF 20–25.

## Regras do V1.4 que importam

- `SolicitadaPor` é descrito como número do cliente; o nome da pessoa/empresa fica em `Contacto`.
- `Telefone` e `TelefoneExp` devem estar preenchidos. A lista de erros menciona limite de 15 caracteres, sem dizer que têm de ser fixos ou ter exatamente nove dígitos.
- Peso é enviado em gramas. Por exemplo, 1,5 kg corresponde a 1500 gramas.
- O produto da recolha é obrigatório. A lista oficial é obtida por `GetProdutosRecolha()`; não exige parâmetros segundo o contrato documentado.
- `GuiaTransporte` é uma flag numérica 0/1, não uma simples observação em texto.
- `VariosDest` é outra flag 0/1. O manual não explica uma dispensa geral dos campos de destinatário quando vale 1; essa dispensa não deve ser inventada.
- As pesquisas requerem o número da recolha ou intervalo de datas; a lista de erros estabelece um máximo de 60 dias.
- Uma nova data sugerida por ultrapassagem da hora de corte não equivale a uma recolha criada.
- Em sucesso existe número de recolha. Uma mensagem ou ausência de exceção não substitui essa confirmação.

## Inconsistências e limites do próprio PDF

1. O anexo usa endereços `localhost`. São exemplos de desenvolvimento e não um endpoint de produção utilizável.
2. A assinatura textual de `GetRecolha` menciona `NIF`, mas a tabela e o schema especificam `ID` GUID. Para serializar, é necessário confirmar o contrato efetivo.
3. A descrição de `GetAreaInfluencia` apresenta `Error`, `Descricao`, `SE` e `Valido`; o anexo apresenta `_erros`, `_ZTax` e `_ValidaSEP`. O parser não pode assumir que a descrição narrativa e o schema têm exatamente os mesmos nomes.
4. Há pequenas diferenças de nomenclatura, como `GetEstadossRecolha` no texto versus `GetEstadosRecolha` no WSDL.

Estas diferenças reforçam a necessidade de cruzar a explicação com o WSDL da operação realmente utilizada. O documento, isoladamente, não confirma permissões das credenciais nem comportamento de uma versão posterior.

## O que sabemos dos testes anteriores — separado do manual

- `NewOfferPickUp` devolveu `EW0074: ClientData: Phone Number is not valid.` para os contactos móveis testados, incluindo o contacto da Linke, com país PT. O contacto móvel do local não recebeu o mesmo erro no formato nacional.
- Um contacto de teste iniciado por 255 não recebeu esse erro de telefone. Isso mostra uma diferença na validação observada; não prova uma regra universal de obrigatoriedade de telefone fixo.
- Os pedidos eram deliberadamente inválidos noutros campos e devolveram falha, sem número de recolha. Não comprovam que uma recolha completa tenha sido aceite.
- `MarcarRecolha` devolveu `Falhou a autenticação do cliente` com os parâmetros testados. Isto não demonstra que o método esteja desativado, nem permite avaliar a aceitação do telemóvel nesse método. A combinação cliente/contrato/GUID e as permissões precisam de confirmação.
- Não há fundamento neste PDF para resolver o problema substituindo o número real por um número fictício, mudando o país da recolha ou atribuindo o contacto de outra loja.

## Implicação para a continuação do trabalho

A separação Linke/loja deve manter-se. Antes de outra alteração de protocolo, confirmar com os CTT qual o método habilitado para a conta e o formato exigido para o contacto do solicitante nesse método. Para `NewOfferPickUp`, usar a especificação correspondente e o WSDL atual, sem importar automaticamente as regras do V1.4.

Este estudo não alterou a integração nem executou novos pedidos de marcação.
