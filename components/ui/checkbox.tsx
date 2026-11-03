"use client";
import * as Primitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import type { ComponentProps } from "react";
export function Checkbox({
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      {...props}
      className={`flex size-4 shrink-0 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--surface-bg)] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#38664b] data-[state=checked]:border-[#38664b] data-[state=checked]:bg-[#38664b] disabled:opacity-50 ${className}`}
    >
      <Primitive.Indicator>
        <Check size={12} />
      </Primitive.Indicator>
    </Primitive.Root>
  );
}
