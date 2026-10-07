import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const run = async () => {
  const fs = await import('fs');
  const envStr = fs.readFileSync('.env.local', 'utf8');
  const rtokenMatch = envStr.match(/MOLONI_REFRESH_TOKEN=(.+)/);
  const rtoken = rtokenMatch[1].trim();
  const cid = envStr.match(/MOLONI_CLIENT_ID=(.+)/)[1].trim();
  const csec = envStr.match(/MOLONI_CLIENT_SECRET=(.+)/)[1].trim();
  
  const grantRes = await fetch(`https://api.moloni.pt/v1/grant/?grant_type=refresh_token&client_id=${cid}&client_secret=${csec}&refresh_token=${rtoken}`);
  const grantData = await grantRes.json();
  const token = grantData.access_token;
  if (!token) { console.log(grantData); return; }

  // Persist back new refresh token
  const newRToken = grantData.refresh_token;
  let newEnv = envStr.replace(/MOLONI_REFRESH_TOKEN=.*/, `MOLONI_REFRESH_TOKEN=${newRToken}`);
  fs.writeFileSync('.env.local', newEnv);

  const res = await fetch(`https://api.moloni.pt/v1/documentSets/getAll/?access_token=${token}&json=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_id: 393993 })
  });
  
  const sets = await res.json();
  console.log(JSON.stringify(sets, null, 2));
};
run();
