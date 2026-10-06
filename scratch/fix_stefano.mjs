import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load env vars manually
const envContent = fs.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envContent.split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => line.split("="))
    .map(([k, ...v]) => [k, v.join("=").replace(/^"|"$/g, '')])
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing env vars", { supabaseUrl, supabaseKey });
  process.exit(1);
}
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
  const stefano = usersData.users.find(u => u.email === "stefano.remy@gmail.com");
  if (!stefano) {
    console.log("Stefano not found");
    return;
  }
  
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(stefano.id, {
    app_metadata: {
      role: 'admin',
      access_level: 'Administrador',
      permissions: ['Acesso Total (Super-Admin)']
    },
    user_metadata: {
      role: 'admin',
      access_level: 'Administrador',
      permissions: ['Acesso Total (Super-Admin)']
    }
  });
  console.log("Update result:", error ? error.message : "Success");
}
run();
