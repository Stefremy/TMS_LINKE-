"use client";
import type { ComponentProps } from "react";
import { TimeGrid } from "./TimeGrid";
export function DayView({
  date,
  ...props
}: Omit<ComponentProps<typeof TimeGrid>, "days"> & { date: string }) {
  return <TimeGrid {...props} days={[date]} />;
}
