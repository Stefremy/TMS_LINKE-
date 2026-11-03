"use client";
import type { ComponentProps } from "react";
import { TimeGrid } from "./TimeGrid";
import { addDays, startOfWeek } from "../lib/dates";
export function WeekView({
  date,
  ...props
}: Omit<ComponentProps<typeof TimeGrid>, "days"> & { date: string }) {
  return (
    <TimeGrid
      {...props}
      days={Array.from({ length: 7 }, (_, index) =>
        addDays(startOfWeek(date), index),
      )}
    />
  );
}
