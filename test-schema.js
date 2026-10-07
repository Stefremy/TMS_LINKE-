require("dotenv").config({path: ".env.local"});
async function run() {
  const payload = {
    id: "a-fake-id",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    client_id: "b79cab49-629a-49f1-99c6-ef711e040cf7",
    tracking_number: "LTK9999999",
    carrier_tracking_number: "EQ419920315PT",
    carrier_code: "ctt",
    service_type: "CTT Expresso 24H",
    status: "pendente",
    ops_substatus: null,
    sender_name: "Test",
    sender_address: "Test",
    sender_zip3: "001",
    sender_zip4: "1000",
    recipient_name: "Test",
    recipient_address: "Test",
    recipient_zip3: "001",
    recipient_zip4: "1000",
    buy_price: 2.0,
    sell_price: 3.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    reference: "LTK9999999",
    special_fees_amount: 0,
    special_fees_description: null,
    cod_value: 0,
    length_cm: 0,
    width_cm: 0,
    height_cm: 0,
  };
  
  const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/shipments", {
    method: "POST",
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify(payload)
  });
  console.log(await res.json());
}
run();
