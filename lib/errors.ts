/** Preserve provider/Error messages without assuming that thrown values are Errors. */
export function errorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("message" in error)) return undefined
  return typeof error.message === "string" ? error.message : undefined
}
