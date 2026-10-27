/** Keep customs failures actionable within the form that was submitted. */
export function focusCttCustomsFields(form: HTMLFormElement, message: string): void {
  if (!/aduaneir|alfandeg|artigo|código pautal|fatura|factura/i.test(message)) return
  const section = form.querySelector?.<HTMLElement>("[data-ctt-customs-fields]")
  section?.scrollIntoView({ behavior: "smooth", block: "center" })
  section?.focus({ preventScroll: true })
}
