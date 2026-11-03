"use client";
import * as Primitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";
export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverClose = Primitive.Close;
export function PopoverContent({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={6}
        {...props}
        className={`z-[90] w-72 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-3 text-[var(--text-primary)] shadow-xl outline-none ${className}`}
      >
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
