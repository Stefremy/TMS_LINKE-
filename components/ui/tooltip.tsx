"use client";
import * as Primitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
export const TooltipProvider = Primitive.Provider;
export function Tooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          sideOffset={5}
          className="z-[120] max-w-xs rounded-md bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg"
        >
          {content}
          <Primitive.Arrow className="fill-zinc-900" />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
