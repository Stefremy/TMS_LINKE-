import { CTTPickupService } from "./lib/services/ctt/ctt-pickup.service";

async function main() {
  const service = new CTTPickupService();
  const creds = {
    environment: "production",
    contract_number: "",
    client_number: "",
    auth_id: ""
  } as any;
  const products = await service.getProdutosRecolha(creds);
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error);
