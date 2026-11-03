/** Remove carrier API identifiers from configured descriptions, without changing their stored identity. */
export function shipmentOptionLabel(name: string): string {
  const technical = /^[A-Za-z][A-Za-z /-]*\s*\(([^()]*)\)\s*$/.exec(name)
  return technical?.[1].trim() || name
}
