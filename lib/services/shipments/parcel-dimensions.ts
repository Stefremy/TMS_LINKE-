export type ParcelDimensionsCm = { length: number; width: number; height: number }

/** Show island measurements as soon as the Portuguese postal prefix is entered. */
export function requiresShipmentDimensions(country: string, postal: string): boolean {
  return country.trim().toUpperCase() !== "PT" || postal.trim().startsWith("9")
}

export function isMainlandPortugalDestination(country: string, postal: string): boolean {
  return !requiresShipmentDimensions(country, postal) && /^\d{4}-?\d{3}$/.test(postal.trim())
}

/** Zeroes represent measurements that were not requested, never actual dimensions. */
export function hasOmittedParcelDimensions(parcel: { lengthCm?: number; widthCm?: number; heightCm?: number }): boolean {
  return parcel.lengthCm === 0 && parcel.widthCm === 0 && parcel.heightCm === 0
}

export function validateParcelDimensions(dimensions: ParcelDimensionsCm): ParcelDimensionsCm {
  if (![dimensions.length, dimensions.width, dimensions.height].every(value => Number.isFinite(value) && value >= 0.1)) {
    throw new Error("Indique comprimento, largura e altura válidos em centímetros.")
  }
  return dimensions
}

/** CTT accepts 50 observation characters, but some label templates print less.
 * Put compact, complete dimensions first so a note/prefix cannot hide height. */
export function cttParcelObservations(dimensions: ParcelDimensionsCm, observations?: string): string {
  validateParcelDimensions(dimensions)
  const measures = `${dimensions.length}x${dimensions.width}x${dimensions.height}cm`
  if (measures.length > 50) throw new Error("Confirme as dimensões do volume; os valores indicados são demasiado extensos.")
  const note = observations?.trim().slice(0, Math.max(0, 50 - measures.length - 3)).trimEnd()
  return note ? `${measures} | ${note}` : measures
}
