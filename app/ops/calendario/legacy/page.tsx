import LegacyCalendarPage from "../LegacyCalendarPage";
import { requireOpsPageAccess } from "@/lib/auth/ops-page-access";

export { metadata } from "../LegacyCalendarPage";

export default async function LegacyCalendarRoute() {
  await requireOpsPageAccess("/ops/calendario/legacy");
  return <LegacyCalendarPage />;
}
