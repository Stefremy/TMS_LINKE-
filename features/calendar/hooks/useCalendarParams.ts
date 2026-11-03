"use client";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useSearchParams } from "next/navigation";
import { isValidDate } from "../lib/dates";
export function useCalendarParams(today: string) {
  const search = useSearchParams();
  const [params, setParams] = useQueryStates(
    {
      view: parseAsStringLiteral(["month", "week", "day", "agenda"] as const)
        .withDefault("month")
        .withOptions({ clearOnDefault: false }),
      date: parseAsString.withDefault(today),
      collab: parseAsArrayOf(parseAsString).withDefault([]),
      event: parseAsString,
      mine: parseAsBoolean.withDefault(false),
      holidays: parseAsArrayOf(parseAsString).withDefault(["PT", "ES"]),
    },
    { history: "replace", shallow: true, scroll: false },
  );
  return {
    params: { ...params, date: isValidDate(params.date) ? params.date : today },
    setParams,
    explicitView: search.has("view"),
  };
}
