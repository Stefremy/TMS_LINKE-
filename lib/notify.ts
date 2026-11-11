import { toast } from "sonner"

/**
 * Notificações no ecrã (substituem window.alert). Não bloqueiam a página nem funcionam mal no telemóvel.
 *
 *  - success  → confirma uma ação (4 s)
 *  - info     → informação neutra (5 s)
 *  - warning  → falta algo ou ação não permitida (8 s)
 *  - error    → a ação falhou (10 s)
 *  - critical → resultado incerto com risco de duplicar dinheiro/documentos (ex.: emissão Moloni sem
 *               confirmação). Fica no ecrã até ser fechado, como o alert() fazia.
 */
export const notify = {
  success: (message: string) => toast.success(message, { duration: 4000 }),
  info: (message: string) => toast.info(message, { duration: 5000 }),
  warning: (message: string) => toast.warning(message, { duration: 8000 }),
  error: (message: string) => toast.error(message, { duration: 10000 }),
  critical: (message: string) => toast.error(message, { duration: Infinity }),
}
