"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export function SheetContent({
  children,
  className = "",
  side = "right",
  ...props
}: ComponentProps<typeof Dialog.Content> & { side?: "left" | "right" }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-[2px]" />
      <Dialog.Content
        {...props}
        className={`fixed inset-y-0 z-[101] flex w-[min(100%,480px)] flex-col overflow-y-auto border-[var(--border-subtle)] bg-[var(--surface-bg)] p-6 text-[var(--text-primary)] shadow-2xl ${side === "left" ? "left-0 border-r" : "right-0 border-l"} ${className}`}
      >
        {children}
        <Dialog.Close
          aria-label="Fechar painel"
          className="absolute right-4 top-4 rounded-md p-2 text-[var(--text-secondary)] outline-none hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[#38664b]"
        >
          <X size={17} />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
