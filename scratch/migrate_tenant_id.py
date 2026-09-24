import os
import re

directory = "app/actions"
for filename in os.listdir(directory):
    if filename.endswith(".ts"):
        filepath = os.path.join(directory, filename)
        with open(filepath, "r") as f:
            content = f.read()
            
        # We don't want to blindly replace LINKE_TENANT_ID with ctx.tenant_id everywhere, 
        # it's better to just delete the top-level const and replace its usages with 
        # a new global getter `await getTenantId()`, or just define `async function getTenantId()` inside each file temporarily?
        # Actually, let's just create a shared helper in lib/auth/context.ts: 
        # export async function getTenantId() { return (await getAuthContext())?.tenant_id || "11111111-1111-1111-1111-111111111111" }
        # And replace `LINKE_TENANT_ID` with `(await getTenantId())`
