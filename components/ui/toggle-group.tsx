"use client";
import * as Primitive from "@radix-ui/react-toggle-group";
import type { ComponentProps } from "react";
export function ToggleGroup({
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      {...props}
      className={`inline-flex items-center gap-1 rounded-lg bg-[var(--surface-muted)] p-1 ${className}`}
    />
  );
}
export function ToggleGroupItem({
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      {...props}
      className={`rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] outline-none hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[#38664b] data-[state=on]:bg-[var(--surface-bg)] data-[state=on]:text-[var(--text-primary)] data-[state=on]:shadow-sm ${className}`}
    />
  );
}
