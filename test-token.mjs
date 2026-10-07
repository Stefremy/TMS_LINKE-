import fs from 'fs';
const envStr = fs.readFileSync('.env.local', 'utf8');
const rtokenMatch = envStr.match(/MOLONI_REFRESH_TOKEN=(.+)/);
const rtoken = rtokenMatch[1].trim();
const cid = envStr.match(/MOLONI_CLIENT_ID=(.+)/)[1].trim();
const csec = envStr.match(/MOLONI_CLIENT_SECRET=(.+)/)[1].trim();

const res = await fetch(`https://api.moloni.pt/v1/grant/?grant_type=refresh_token&client_id=${cid}&client_secret=${csec}&refresh_token=${rtoken}`);
const data = await res.json();
console.log(data.access_token);
