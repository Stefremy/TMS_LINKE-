/** Keep the unfinished pickup-point table out of the catalog until its integration is ready. */
export function isTemporarilyWithdrawnService(service: { id?: string; code?: string }): boolean {
  return service.id === "srv_linke_ponto_ctt" || service.code?.trim().toUpperCase() === "LK-PONTO"
}
