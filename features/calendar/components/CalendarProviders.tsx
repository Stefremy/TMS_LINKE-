"use client";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
export function CalendarProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <NuqsAdapter>
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={350}>
          {children}
          <Toaster
            containerAriaLabel="Notificações do calendário"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--surface-bg)",
                color: "var(--text-primary)",
                borderColor: "var(--border-subtle)",
              },
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsAdapter>
  );
}
