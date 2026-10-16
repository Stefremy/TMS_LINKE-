import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Clock3,
  Construction,
  Euro,
  GitBranch,
  Globe2,
  Mail,
  Map,
  Package,
  Radio,
  ReceiptText,
  Ruler,
  Truck,
} from "lucide-react"
import { ThemeSettings } from "./ThemeSettings"

const currentDefaults = [
  { label: "Idioma e formato", value: "Português (Portugal)", detail: "Datas e números em formato português.", icon: Globe2 },
  { label: "Fuso horário", value: "Europe/Lisbon", detail: "Usado nos relatórios e ciclos de faturação.", icon: Clock3 },
  { label: "Moeda", value: "Euro (€)", detail: "Valores de preços e faturação.", icon: Euro },
  { label: "Unidades de envio", value: "kg e cm", detail: "Peso e dimensões das encomendas.", icon: Ruler },
]

const availableSettings = [
  { title: "Serviços e tabelas de preço", description: "Serviços Linke, tabelas de cliente e margens.", href: "/ops/configuracao/servicos", icon: Package },
  { title: "Faturação e Moloni", description: "Ligação ao Moloni e regras de faturação.", href: "/ops/configuracao/faturacao", icon: ReceiptText },
  { title: "Transportadoras", description: "Logótipos e identificação dos parceiros.", href: "/ops/configuracao/transportadoras", icon: Truck },
  { title: "Webservices", description: "Ligações técnicas às transportadoras.", href: "/ops/configuracao/webservices", icon: Radio },
  { title: "Email e notificações", description: "Remetente e modelos de email da plataforma.", href: "/ops/configuracao/notificacoes", icon: Mail },
]

const inDevelopment = [
  { title: "Empresas", description: "Dados das empresas da operação.", icon: Building2 },
  { title: "Zonas de preço", description: "Zonas de entrega e respetivo mapeamento.", icon: Map },
  { title: "Estados de envio", description: "Estados e etapas do ciclo de vida.", icon: GitBranch },
]

export default function ConfiguraçõesGeraisPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-10 sm:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Sistema</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">Configurações gerais</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
          Consulta os padrões usados pelo TMS e encontra rapidamente cada área de configuração.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-[var(--shadow-layer)]">
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Padrões atuais da plataforma</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Estes valores são usados em diferentes áreas; ainda não são editáveis nesta página.
          </p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          {currentDefaults.map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className="flex gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ThemeSettings />

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Áreas disponíveis</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Abre a área para consultar ou gerir as respetivas definições.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {availableSettings.map(({ title, description, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-28 items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-[var(--shadow-layer)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  {title}<ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Construction className="h-4 w-4 text-[var(--text-tertiary)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Áreas em desenvolvimento</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {inDevelopment.map(({ title, description, icon: Icon }) => (
            <div key={title} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />{title}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-tertiary)]">
                <Clock3 className="h-3 w-3" /> Em preparação
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
