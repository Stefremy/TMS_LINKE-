import { logoutSession } from "@/lib/auth/logout"

/** Native form submission avoids Server Action redirects and stale deployment references. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response("Origem não autorizada.", { status: 403, headers: { "Cache-Control": "no-store" } })
  }
  const destination = await logoutSession()
  // A relative Location stays on the browser's current host, including deployment aliases.
  return new Response(null, { status: 303, headers: { Location: destination, "Cache-Control": "no-store", Vary: "Cookie" } })
}
