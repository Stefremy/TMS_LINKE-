"use client";
import * as Primitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-[110] bg-black/40" />
      <Primitive.Content
        {...props}
        className={`fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-6 text-[var(--text-primary)] shadow-xl ${className}`}
      >
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
