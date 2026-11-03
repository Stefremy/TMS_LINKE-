"use client";
import * as Primitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";
export function Switch({
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      {...props}
      className={`h-5 w-9 shrink-0 rounded-full bg-[var(--border-strong)] outline-none focus-visible:ring-2 focus-visible:ring-[#38664b] focus-visible:ring-offset-2 data-[state=checked]:bg-[#38664b] disabled:opacity-50 ${className}`}
    >
      <Primitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px] motion-reduce:transition-none" />
    </Primitive.Root>
  );
}
