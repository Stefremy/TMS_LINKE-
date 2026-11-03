export type CalendarView = "month" | "week" | "day" | "agenda";
export type CalendarCollaborator = {
  id: string;
  name: string;
  email: string;
  color?: string;
};
export type CalendarViewer = {
  id: string;
  email: string;
  tenantId: string;
  isAdmin: boolean;
  collaboratorId: string | null;
};
export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  time: string | null;
  all_day: boolean;
  collab_id: string;
  creator_email: string | null;
  creator_id: string | null;
  updated_at: string;
  shipment_tracking_number: string | null;
  color?: string;
  legacy?: boolean;
  read_only?: boolean;
  holiday_country?: "PT" | "ES";
};
export type CalendarRow = {
  id: string;
  group_id?: string;
  event_date: string;
  title: string;
  description?: string | null;
  time?: string | null;
  all_day?: boolean;
  collab_id: string;
  creator_email?: string | null;
  creator_id?: string | null;
  updated_at?: string;
  created_at?: string;
  shipment_tracking_number?: string | null;
};
export type CalendarRangeData = {
  events: CalendarEvent[];
  migrationRequired: boolean;
};
export const collaboratorColors = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#059669",
  "#0891b2",
];
export function collaboratorColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return collaboratorColors[hash % collaboratorColors.length];
}
export function canManageEvent(event: CalendarEvent, viewer: CalendarViewer) {
  return (
    !event.legacy &&
    !event.read_only &&
    (viewer.isAdmin ||
      (event.creator_id
        ? event.creator_id === viewer.id
        : !!viewer.email &&
          event.creator_email?.toLowerCase() === viewer.email.toLowerCase()))
  );
}

export type CalendarActionResult =
  | {
      success: true;
      error?: never;
      data?: CalendarRow;
      events?: CalendarRow[];
      event?: CalendarEvent;
    }
  | {
      success: false;
      error: string;
      fieldErrors?: { field: string; message: string }[];
    };
