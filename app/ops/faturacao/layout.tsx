import { MoloniTestModeBanner } from "@/app/ops/components/MoloniTestModeBanner"

export default function FaturacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MoloniTestModeBanner />
      {children}
    </>
  )
}
