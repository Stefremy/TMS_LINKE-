/** A contact line is useful only when a different person is explicitly supplied. */
export function distinctContactName(name: string, contact?: string): string | undefined {
  const value = contact?.trim()
  const normalized = (text: string) => text.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-PT")
  return value && normalized(value) !== normalized(name) ? value : undefined
}
