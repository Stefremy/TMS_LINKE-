export interface GeoCoordinate {
  lat: number
  lng: number
  name: string
  district?: string
}

// Main city and logistics hubs coordinates in Portugal and Spain
const KNOWN_LOCATIONS: Record<string, GeoCoordinate> = {
  // Hubs & Centros de Tratamento CTT / Linke
  "ctc lisboa": { lat: 38.784, lng: -9.125, name: "Centro de Tratamento Lisboa (Prior Velho)", district: "Lisboa" },
  "ctc porto": { lat: 41.229, lng: -8.621, name: "Centro de Tratamento Porto (Maia)", district: "Porto" },
  "ctc coimbra": { lat: 40.231, lng: -8.435, name: "Centro de Tratamento Coimbra (Taveiro)", district: "Coimbra" },
  "hub lisboa": { lat: 38.775, lng: -9.135, name: "Hub Central Lisboa", district: "Lisboa" },
  "hub porto": { lat: 41.198, lng: -8.642, name: "Hub Regional Porto", district: "Porto" },
  "marl": { lat: 38.852, lng: -9.122, name: "MARL (Mercado Abastecedor da Região de Lisboa)", district: "Loures" },

  // Portuguese Districts / Major Cities
  "lisboa": { lat: 38.722, lng: -9.139, name: "Lisboa", district: "Lisboa" },
  "porto": { lat: 41.157, lng: -8.629, name: "Porto", district: "Porto" },
  "coimbra": { lat: 40.205, lng: -8.419, name: "Coimbra", district: "Coimbra" },
  "braga": { lat: 41.545, lng: -8.426, name: "Braga", district: "Braga" },
  "aveiro": { lat: 40.640, lng: -8.653, name: "Aveiro", district: "Aveiro" },
  "setúbal": { lat: 38.524, lng: -8.893, name: "Setúbal", district: "Setúbal" },
  "setubal": { lat: 38.524, lng: -8.893, name: "Setúbal", district: "Setúbal" },
  "leiria": { lat: 39.743, lng: -8.807, name: "Leiria", district: "Leiria" },
  "santarém": { lat: 39.236, lng: -8.685, name: "Santarém", district: "Santarém" },
  "santarem": { lat: 39.236, lng: -8.685, name: "Santarém", district: "Santarém" },
  "faro": { lat: 37.019, lng: -7.930, name: "Faro", district: "Faro" },
  "évora": { lat: 38.571, lng: -7.907, name: "Évora", district: "Évora" },
  "evora": { lat: 38.571, lng: -7.907, name: "Évora", district: "Évora" },
  "beja": { lat: 38.015, lng: -7.863, name: "Beja", district: "Beja" },
  "viseu": { lat: 40.656, lng: -7.912, name: "Viseu", district: "Viseu" },
  "guarda": { lat: 40.537, lng: -7.268, name: "Guarda", district: "Guarda" },
  "castelo branco": { lat: 39.822, lng: -7.493, name: "Castelo Branco", district: "Castelo Branco" },
  "portalegre": { lat: 39.293, lng: -7.431, name: "Portalegre", district: "Portalegre" },
  "viana do castelo": { lat: 41.691, lng: -8.834, name: "Viana do Castelo", district: "Viana do Castelo" },
  "vila real": { lat: 41.300, lng: -7.744, name: "Vila Real", district: "Vila Real" },
  "bragança": { lat: 41.806, lng: -6.756, name: "Bragança", district: "Bragança" },
  "braganca": { lat: 41.806, lng: -6.756, name: "Bragança", district: "Bragança" },

  // Key Sub-municipalities & Industrial Parks
  "maia": { lat: 41.229, lng: -8.621, name: "Maia", district: "Porto" },
  "vila nova de gaia": { lat: 41.133, lng: -8.616, name: "Vila Nova de Gaia", district: "Porto" },
  "matosinhos": { lat: 41.184, lng: -8.696, name: "Matosinhos", district: "Porto" },
  "sintra": { lat: 38.802, lng: -9.381, name: "Sintra", district: "Lisboa" },
  "cascais": { lat: 38.697, lng: -9.422, name: "Cascais", district: "Lisboa" },
  "loures": { lat: 38.831, lng: -9.167, name: "Loures", district: "Lisboa" },
  "odivelas": { lat: 38.795, lng: -9.183, name: "Odivelas", district: "Lisboa" },
  "amadora": { lat: 38.759, lng: -9.224, name: "Amadora", district: "Lisboa" },
  "almada": { lat: 38.680, lng: -9.158, name: "Almada", district: "Setúbal" },
  "seixal": { lat: 38.643, lng: -9.102, name: "Seixal", district: "Setúbal" },
  "guimarães": { lat: 41.442, lng: -8.291, name: "Guimarães", district: "Braga" },
  "famalicão": { lat: 41.408, lng: -8.519, name: "Vila Nova de Famalicão", district: "Braga" },
  "figueira da foz": { lat: 40.150, lng: -8.861, name: "Figueira da Foz", district: "Coimbra" },
  "loulé": { lat: 37.138, lng: -8.022, name: "Loulé", district: "Faro" },
  "portimão": { lat: 37.138, lng: -8.537, name: "Portimão", district: "Faro" },

  // Spain
  "madrid": { lat: 40.416, lng: -3.703, name: "Madrid", district: "Comunidad de Madrid" },
  "barcelona": { lat: 41.387, lng: 2.168, name: "Barcelona", district: "Cataluña" },
  "valencia": { lat: 39.469, lng: -0.376, name: "Valencia", district: "Comunidad Valenciana" },
  "sevilla": { lat: 37.389, lng: -5.984, name: "Sevilla", district: "Andalucía" },
  "badajoz": { lat: 38.879, lng: -6.970, name: "Badajoz", district: "Extremadura" },
  "vigo": { lat: 42.240, lng: -8.720, name: "Vigo", district: "Galicia" },
}

/**
 * Resolve geographic coordinate from city name, hub name, or postal code
 */
export function resolveLocationCoordinate(
  query?: string | null,
  postalCode?: string | null
): GeoCoordinate {
  const normalizedQuery = (query || "").toLowerCase().trim()

  // 1. Direct city match
  if (normalizedQuery && KNOWN_LOCATIONS[normalizedQuery]) {
    return KNOWN_LOCATIONS[normalizedQuery]
  }

  // 2. Partial name match
  for (const [key, val] of Object.entries(KNOWN_LOCATIONS)) {
    if (normalizedQuery && (normalizedQuery.includes(key) || key.includes(normalizedQuery))) {
      return val
    }
  }

  // 3. Fallback based on Postal Code prefix (First 2 digits)
  const cleanCode = (postalCode || "").trim().replace(/\D/g, "")
  if (cleanCode.length >= 2) {
    const prefix = cleanCode.substring(0, 2)
    switch (prefix) {
      case "10": case "11": case "12": case "13": case "14":
      case "15": case "16": case "17": case "18": case "19":
        return KNOWN_LOCATIONS["lisboa"]
      case "26": case "27":
        return KNOWN_LOCATIONS["loures"]
      case "20": case "21": case "22": case "23":
        return KNOWN_LOCATIONS["santarém"]
      case "24": case "25":
        return KNOWN_LOCATIONS["leiria"]
      case "28": case "29":
        return KNOWN_LOCATIONS["setúbal"]
      case "30": case "31": case "32": case "33": case "34":
        return KNOWN_LOCATIONS["coimbra"]
      case "35": case "36":
        return KNOWN_LOCATIONS["viseu"]
      case "37": case "38":
        return KNOWN_LOCATIONS["aveiro"]
      case "40": case "41": case "42": case "43":
        return KNOWN_LOCATIONS["porto"]
      case "44": case "45":
        return KNOWN_LOCATIONS["maia"]
      case "47": case "48":
        return KNOWN_LOCATIONS["braga"]
      case "49":
        return KNOWN_LOCATIONS["viana do castelo"]
      case "50": case "51": case "52":
        return KNOWN_LOCATIONS["vila real"]
      case "53": case "54":
        return KNOWN_LOCATIONS["bragança"]
      case "60": case "61": case "62":
        return KNOWN_LOCATIONS["castelo branco"]
      case "63": case "64":
        return KNOWN_LOCATIONS["guarda"]
      case "70": case "71": case "72":
        return KNOWN_LOCATIONS["évora"]
      case "73": case "74":
        return KNOWN_LOCATIONS["portalegre"]
      case "75": case "76": case "77": case "78":
        return KNOWN_LOCATIONS["beja"]
      case "80": case "81": case "82": case "83":
      case "84": case "85": case "86": case "87": case "88": case "89":
        return KNOWN_LOCATIONS["faro"]
    }
  }

  // Default fallback: Central Portugal
  return { lat: 39.5, lng: -8.5, name: query || "Portugal Central" }
}
