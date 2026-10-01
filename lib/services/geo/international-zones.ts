/**
 * Linke Internacional — Mapeamento Oficial de Países e Tarifas Contratuais
 * Extraído diretamente dos documentos contratuais oficiais:
 *  - ZONAS INTERNACIONAIS.pdf
 *  - TABELA INTERNACIONAL (2).pdf
 */

import type { PriceTierLinke, ZonePriceMatrix } from "@/app/ops/configuracao/servicos/types"

export interface InternationalZoneDefinition {
  code: string
  name: string
  description: string
  fuelSurchargePct: number
  extraHalfKgFee: number
  transitTime: string
  sampleCountries: string[]
}

/**
 * As 8 Zonas Oficiais Internacionais da Linke (Exportação Aérea)
 */
export const OFFICIAL_LINKE_ZONES: Record<string, InternationalZoneDefinition> = {
  "EU 1": {
    code: "EU 1",
    name: "Europa 1 (Ocidental & Central)",
    description: "Alemanha, Áustria, Bélgica, Dinamarca, Espanha, França, Holanda, Irlanda, Itália, Luxemburgo, Mónaco, Reino Unido, Suécia, Vaticano",
    fuelSurchargePct: 8.5,
    extraHalfKgFee: 0.98,
    transitTime: "2-4 dias úteis",
    sampleCountries: ["Alemanha", "França", "Reino Unido", "Itália", "Espanha", "Holanda", "Bélgica"]
  },
  "EU 2": {
    code: "EU 2",
    name: "Europa 2 (Leste & Bálcãs)",
    description: "Albânia, Bulgária, Croácia, Eslováquia, Eslovénia, Estónia, Hungria, Islândia, Letónia, Lituânia, Polónia, Rep. Checa, Roménia, Sérvia, Ucrânia",
    fuelSurchargePct: 8.5,
    extraHalfKgFee: 0.98,
    transitTime: "3-5 dias úteis",
    sampleCountries: ["Polónia", "Rep. Checa", "Roménia", "Hungria", "Croácia", "Bulgária", "Ucrânia"]
  },
  "EU 3": {
    code: "EU 3",
    name: "Europa 3 (EFTA & Mediterrâneo)",
    description: "Andorra, Finlândia, Gibraltar, Grécia, Liechtenstein, Noruega, Suíça",
    fuelSurchargePct: 8.5,
    extraHalfKgFee: 0.98,
    transitTime: "3-5 dias úteis",
    sampleCountries: ["Suíça", "Noruega", "Finlândia", "Grécia", "Andorra"]
  },
  "NA": {
    code: "NA",
    name: "América do Norte",
    description: "Canadá, Estados Unidos, México, Porto Rico",
    fuelSurchargePct: 8.5,
    extraHalfKgFee: 0.98,
    transitTime: "3-6 dias úteis",
    sampleCountries: ["Estados Unidos", "Canadá", "México", "Porto Rico"]
  },
  "SA": {
    code: "SA",
    name: "América do Sul & Central",
    description: "Argentina, Brasil, Chile, Colômbia, Costa Rica, Equador, Guatemala, Panamá, Paraguai, Peru, Rep. Dominicana, Uruguai, Venezuela",
    fuelSurchargePct: 8.5,
    extraHalfKgFee: 0.98,
    transitTime: "4-7 dias úteis",
    sampleCountries: ["Brasil", "Argentina", "Chile", "Colômbia", "Peru", "Panamá"]
  },
  "O1": {
    code: "O1",
    name: "Oriente 1 (Ásia Pacífico Z1 & Egito)",
    description: "Coreia do Sul, Egito, Hong Kong, Indonésia, Japão, Malásia, Singapura, Tailândia, Taiwan",
    fuelSurchargePct: 8.5,
    extraHalfKgFee: 0.98,
    transitTime: "4-7 dias úteis",
    sampleCountries: ["Japão", "Hong Kong", "Singapura", "Coreia do Sul", "Taiwan", "Egito"]
  },
  "O2": {
    code: "O2",
    name: "Oriente 2 (Médio Oriente, Índia, Oceania & China)",
    description: "Arábia Saudita, Austrália, China, Emiratos Árabes Unidos, Índia, Israel, Nova Zelândia, Qatar, Turquia",
    fuelSurchargePct: 8.5,
    extraHalfKgFee: 0.98,
    transitTime: "4-8 dias úteis",
    sampleCountries: ["China", "Emiratos Árabes Unidos", "Austrália", "Índia", "Arábia Saudita", "Turquia"]
  },
  "A": {
    code: "A",
    name: "África & Resto do Mundo",
    description: "África do Sul, Angola, Cabo Verde, Moçambique, Marrocos, Nigéria, Senegal, Tunísia e destinos remotos",
    fuelSurchargePct: 8.5,
    extraHalfKgFee: 0.98,
    transitTime: "5-9 dias úteis",
    sampleCountries: ["Angola", "Moçambique", "Cabo Verde", "África do Sul", "Marrocos", "Nigéria"]
  },
}

/**
 * Matriz Completa de Mapeamento País -> Zona Oficial Linke (~190 países)
 * Baseada no documento ZONAS INTERNACIONAIS.pdf
 */
export const COUNTRY_TO_ZONE_MAP: Record<string, string> = {
  // A
  "AFEGANISTAO": "A", "AF": "A", "AFGHANISTAN": "A",
  "AFRICA DO SUL": "A", "ZA": "A", "SOUTH AFRICA": "A",
  "ALBANIA": "EU 2", "AL": "EU 2",
  "ALEMANHA": "EU 1", "DE": "EU 1", "GERMANY": "EU 1",
  "ANDORRA": "EU 3", "AD": "EU 3",
  "ANGOLA": "A", "AO": "A",
  "ANGUILLA": "SA", "AI": "SA",
  "ANTIGUA": "SA", "AG": "SA", "ANTIGUA E BARBUDA": "SA",
  "ANTILHAS HOLANDESAS": "SA", "ANT. HOLANDESAS": "SA", "AN": "SA",
  "ARABIA SAUDITA": "O2", "SA_ISO": "O2", "SAUDI ARABIA": "O2",
  "ARGELIA": "A", "DZ": "A", "ALGERIA": "A",
  "ARGENTINA": "SA", "AR": "SA",
  "ARMENIA": "A", "AM": "A",
  "ARUBA": "SA", "AW": "SA",
  "AUSTRALIA": "O2", "AU": "O2",
  "AUSTRIA": "EU 1", "AT": "EU 1",
  "AZERBAIJAO": "A", "AZ": "A",

  // B
  "BAHAMAS": "SA", "BS": "SA",
  "BAHREIN": "O2", "BH": "O2", "BAHRAIN": "O2",
  "BANGLADESH": "O2", "BD": "O2",
  "BARBADOS": "SA", "BB": "SA",
  "BELGICA": "EU 1", "BE": "EU 1", "BELGIUM": "EU 1",
  "BELIZE": "SA", "BZ": "SA",
  "BENIM": "A", "BJ": "A", "BENIN": "A",
  "BERMUDAS": "SA", "BM": "SA", "BERMUDA": "SA",
  "BIELORRUSIA": "EU 2", "BY": "EU 2", "BELARUS": "EU 2",
  "BOLIVIA": "SA", "BO": "SA",
  "BOSNIA HERZEGOVINA": "SA", "BA_ISO": "SA", "BOSNIA": "SA",
  "BOTSWANA": "A", "BW": "A",
  "BRASIL": "SA", "BR": "SA", "BRAZIL": "SA",
  "BRUNEI": "O2", "BN": "O2",
  "BULGARIA": "EU 2", "BG": "EU 2",
  "BURKINA FASO": "A", "BF": "A",
  "BURUNDI": "A", "BI": "A",
  "BUTAN": "O2", "BT": "O2", "BHUTAN": "O2",

  // C
  "CABO VERDE": "A", "CV": "A", "CAPE VERDE": "A",
  "CAMBOJA": "O2", "KH": "O2", "CAMBODIA": "O2",
  "CAMAROES": "A", "CM": "A", "CAMEROON": "A",
  "CANADA": "NA", "CA": "NA",
  "CHADE": "A", "TD": "A", "CHAD": "A",
  "CHILE": "SA", "CL": "SA",
  "CHINA": "O2", "CN": "O2",
  "CHIPRE": "O2", "CY": "O2", "CYPRUS": "O2",
  "COLOMBIA": "SA", "CO": "SA",
  "CONGO": "A", "CG": "A",
  "COREIA DO SUL": "O1", "KR": "O1", "SOUTH KOREA": "O1",
  "COSTA DO MARFIM": "A", "CI": "A", "IVORY COAST": "A",
  "COSTA RICA": "SA", "CR": "SA",
  "CROACIA": "EU 2", "HR": "EU 2", "CROATIA": "EU 2",
  "CURAÇAO": "O2", "CURACAO": "O2", "CW": "O2",

  // D
  "DINAMARCA": "EU 1", "DK": "EU 1", "DENMARK": "EU 1",
  "DJIBUTI": "A", "DJ": "A", "DJIBOUTI": "A",
  "DOMINICA": "SA", "DM": "SA",

  // E
  "EQUADOR": "SA", "EC": "SA", "ECUADOR": "SA",
  "EGIPTO": "O1", "EG": "O1", "EGYPT": "O1",
  "EL SALVADOR": "SA", "SV": "SA",
  "EMIRATOS ARABES U.": "O2", "EMIRADOS ARABES UNIDOS": "O2", "AE": "O2", "UAE": "O2",
  "ERITREIA": "A", "ER": "A",
  "ESLOVAQUIA": "EU 2", "SK": "EU 2", "SLOVAKIA": "EU 2",
  "ESLOVENIA": "EU 2", "SI": "EU 2", "SLOVENIA": "EU 2",
  "ESPANHA": "EU 1", "ES": "EU 1", "SPAIN": "EU 1",
  "ESTADOS UNIDOS": "NA", "US": "NA", "USA": "NA", "UNITED STATES": "NA",
  "ESTONIA": "EU 2", "EE": "EU 2",
  "ETIOPIA": "A", "ET": "A", "ETHIOPIA": "A",

  // F
  "FIJI": "A", "FJ": "A",
  "FILIPINAS": "O2", "PH": "O2", "PHILIPPINES": "O2",
  "FINLANDIA": "EU 3", "FI": "EU 3", "FINLAND": "EU 3",
  "FRANÇA": "EU 1", "FRANCA": "EU 1", "FR": "EU 1", "FRANCE": "EU 1",

  // G
  "GABAO": "A", "GA": "A", "GABON": "A",
  "GAMBIA": "A", "GM": "A",
  "GANA": "A", "GH": "A", "GHANA": "A",
  "GEORGIA": "A", "GE": "A",
  "GIBRALTAR": "EU 3", "GI": "EU 3",
  "GRANADA": "SA", "GD": "SA", "GRENADA": "SA",
  "GRECIA": "EU 3", "GR": "EU 3", "GREECE": "EU 3",
  "GROENLANDIA": "EU 1", "GL": "EU 1", "GREENLAND": "EU 1",
  "GUADALUPE": "SA", "GP": "SA", "GUADELOUPE": "SA",
  "GUAM": "A", "GU": "A",
  "GUATEMALA": "SA", "GT": "SA",
  "GUINE": "A", "GN": "A", "GUINEA": "A",
  "GUYANA": "A", "GY": "A",
  "GUIANA FRANCESA": "SA", "GF": "SA",

  // H
  "HAITI": "SA", "HT": "SA",
  "HOLANDA": "EU 1", "NL": "EU 1", "NETHERLANDS": "EU 1", "PAISES BAIXOS": "EU 1",
  "HONDURAS": "SA", "HN": "SA",
  "HONG KONG": "O1", "HK": "O1",
  "HUNGRIA": "EU 2", "HU": "EU 2", "HUNGARY": "EU 2",

  // I
  "INDIA": "O2", "IN": "O2",
  "INDONESIA": "O1", "ID": "O1",
  "IRAQUE": "A", "IQ": "A", "IRAQ": "A",
  "IRLANDA": "EU 1", "IE": "EU 1", "IRELAND": "EU 1",
  "ILHA REUNIAO": "A", "RE": "A", "REUNION": "A",
  "ISLANDIA": "EU 2", "IS": "EU 2", "ICELAND": "EU 2",
  "ILHAS CAIMAO": "SA", "KY": "SA", "CAYMAN ISLANDS": "SA",
  "ILHAS COOK": "A", "CK": "A",
  "ILHAS FAROE": "EU 2", "FO": "EU 2", "FAROE ISLANDS": "EU 2",
  "ILHAS MARSHALL": "A", "MH": "A",
  "ILHAS ST. MARTIN": "SA", "MF": "SA",
  "ILHAS TURCAS E CAICOS": "SA", "TC": "SA",
  "ILHAS VIRGENS BRIT.": "SA", "VG": "SA",
  "ISRAEL": "O2", "IL": "O2",
  "ITALIA": "EU 1", "IT": "EU 1", "ITALY": "EU 1",

  // J
  "JAMAICA": "SA", "JM": "SA",
  "JAPAO": "O1", "JP": "O1", "JAPAN": "O1",
  "JORDANIA": "O2", "JO": "O2", "JORDAN": "O2",

  // K
  "KASAQUISTAO": "A", "CAZAQUISTAO": "A", "KZ": "A", "KAZAKHSTAN": "A",
  "QUENIA": "A", "KE": "A", "KENYA": "A",
  "QUIRGUISTAO": "O2", "KG": "O2",
  "KUWAIT": "O2", "KW": "O2",

  // L
  "LAOS": "O2", "LA": "O2",
  "LESOTO": "A", "LS": "A", "LESOTHO": "A",
  "LIBERIA": "A", "LR": "A",
  "LIBANO": "O2", "LB": "O2", "LEBANON": "O2",
  "LIBIA": "A", "LY": "A", "LIBYA": "A",
  "LIECHTENSTEIN": "EU 3", "LI": "EU 3",
  "LITUANIA": "EU 2", "LT": "EU 2", "LITHUANIA": "EU 2",
  "LUXEMBURGO": "EU 1", "LU": "EU 1", "LUXEMBOURG": "EU 1",

  // M
  "MACAU": "O2", "MO": "O2",
  "MACEDONIA": "EU 2", "MK": "EU 2", "MACEDONIA DO NORTE": "EU 2",
  "MADAGASCAR": "SA", "MG": "SA", // Classificado como SA no documento oficial
  "MALASIA": "O1", "MY": "O1", "MALAYSIA": "O1",
  "MALAWI": "A", "MW": "A",
  "MALDIVAS": "O2", "MV": "O2", "MALDIVES": "O2",
  "MALI": "A", "ML": "A",
  "MALTA": "O2", "MT": "O2",
  "MARROCOS": "A", "MA": "A", "MOROCCO": "A",
  "MARTINICA": "SA", "MQ": "SA", "MARTINIQUE": "SA",
  "MAURITANIA": "A", "MR": "A",
  "MAURICIAS": "A", "MU": "A", "MAURITIUS": "A",
  "MEXICO": "NA", "MX": "NA",
  "MICRONESIA": "A", "FM": "A",
  "MOLDAVIA": "EU 2", "MD": "EU 2", "MOLDOVA": "EU 2",
  "MONACO": "EU 1", "MC": "EU 1",
  "MONGOLIA": "O2", "MN": "O2",
  "MONTENEGRO": "EU 2", "ME": "EU 2",
  "MONTSERRAT": "SA", "MS": "SA",
  "MOCAMBIQUE": "A", "MZ": "A", "MOZAMBIQUE": "A",

  // N
  "NAMIBIA": "A", "NA_ISO": "A",
  "NEPAL": "O2", "NP": "O2",
  "NICARAGUA": "SA", "NI": "SA",
  "NIGER": "A", "NE": "A",
  "NIGERIA": "A", "NG": "A",
  "NORUEGA": "EU 3", "NO": "EU 3", "NORWAY": "EU 3",
  "NOVA CALEDONIA": "A", "NC": "A",
  "NOVA ZELANDIA": "O2", "NZ": "O2", "NEW ZEALAND": "O2",

  // O
  "OMAN": "O2", "OM": "O2", "OMA": "O2",

  // P
  "PAQUISTAO": "O2", "PK": "O2", "PAKISTAN": "O2",
  "PALAU": "A", "PW": "A",
  "PALESTINA": "O2", "PS": "O2", "PALESTINE": "O2",
  "PANAMA": "SA", "PA": "SA",
  "PAPUA NOVA GUINE": "A", "PG": "A",
  "PARAGUAI": "SA", "PY": "SA", "PARAGUAY": "SA",
  "PERU": "SA", "PE": "SA",
  "POLINESIA FRANCESA": "A", "PF": "A",
  "POLONIA": "EU 2", "PL": "EU 2", "POLAND": "EU 2",
  "PORTO RICO": "NA", "PR": "NA", "PUERTO RICO": "NA",

  // Q
  "QATAR": "O2", "QA": "O2", "CATAR": "O2",

  // R
  "REINO UNIDO": "EU 1", "GB": "EU 1", "UK": "EU 1", "UNITED KINGDOM": "EU 1",
  "REP. CENTRAL AFRICANA": "A", "CF": "A",
  "REP. CHECA": "EU 2", "CZ": "EU 2", "CZECH REPUBLIC": "EU 2",
  "REP. DEM. DO CONGO": "A", "CD": "A",
  "REP. DOMINICANA": "SA", "DO": "SA", "DOMINICAN REPUBLIC": "SA",
  "RUANDA": "A", "RW": "A", "RWANDA": "A",
  "ROMENIA": "EU 2", "RO": "EU 2", "ROMANIA": "EU 2",
  "RUSSIA": "EU 2", "RU": "EU 2",

  // S
  "SAIPAN, ILHAS MARIANAS": "A", "MP": "A",
  "SAMOA AMERICANA": "A", "AS": "A",
  "S. VICENTE E GRANADINAS": "SA", "VC": "SA",
  "SANTA LUCIA": "SA", "LC": "SA",
  "SENEGAL": "A", "SN": "A",
  "SERVIA": "EU 2", "RS": "EU 2", "SERBIA": "EU 2",
  "SEYCHELLES": "A", "SC": "A",
  "SINGAPURA": "O1", "SG": "O1", "SINGAPORE": "O1",
  "SOMALIA": "A", "SO": "A",
  "SRI LANKA": "O2", "LK": "O2",
  "ST KITTS E NEVIS": "SA", "KN": "SA",
  "SUECIA": "EU 1", "SE": "EU 1", "SWEDEN": "EU 1",
  "SUICA": "EU 3", "CH": "EU 3", "SWITZERLAND": "EU 3",
  "SURINAME": "SA", "SR": "SA",
  "SUAZILANDIA": "A", "SZ": "A", "ESWATINI": "A",

  // T
  "TAILANDIA": "O1", "TH": "O1", "THAILAND": "O1",
  "TAIWAN": "O1", "TW": "O1",
  "TANZANIA": "A", "TZ": "A",
  "TIMOR LESTE": "A", "TL": "A",
  "TOGO": "A", "TG": "A",
  "TONGA": "A", "TO": "A",
  "TRINIDADE E TOBAGO": "SA", "TT": "SA",
  "TUNISIA": "A", "TN": "A",
  "TURQUIA": "O2", "TR": "O2", "TURKEY": "O2",
  "TURQUEMENISTAO": "A", "TM": "A",
  "TURKS AND CAICOS": "SA",

  // U
  "UCRANIA": "EU 2", "UA": "EU 2", "UKRAINE": "EU 2",
  "UGANDA": "A", "UG": "A",
  "URUGUAI": "SA", "UY": "SA", "URUGUAY": "SA",
  "UZBEQUISTAO": "A", "UZ": "A",

  // V
  "VANUATU": "A", "VU": "A",
  "VATICANO": "EU 1", "VA": "EU 1",
  "VENEZUELA": "SA", "VE": "SA",
  "VIETNAM": "O2", "VN": "O2", "VIETNAME": "O2",

  // W / Y / Z
  "WALLIS Y FUTUNA": "A", "WF": "A",
  "IEMEN": "O2", "YE": "O2", "YEMEN": "O2",
  "ZAIRE": "A",
  "ZAMBIA": "A", "ZM": "A",
  "ZIMBABWE": "A", "ZW": "A",
}

/**
 * Função inteligente de normalização e resolução de destino
 * Devolve o código da zona correspondente (ou null se desconhecido)
 */
export function resolveInternationalZone(rawCountry: string): string | null {
  if (!rawCountry) return null
  const clean = rawCountry
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/gi, "")

  if (COUNTRY_TO_ZONE_MAP[clean]) {
    return COUNTRY_TO_ZONE_MAP[clean]
  }

  // Tenta encontrar por inclusão de substring
  for (const [key, zone] of Object.entries(COUNTRY_TO_ZONE_MAP)) {
    if (key.length > 3 && (clean.includes(key) || key.includes(clean))) {
      return zone
    }
  }

  return null
}

/**
 * TABELA OFICIAL DE EXPORTAÇÃO AÉREA (Linke International Express)
 * Valores oficiais extraídos de TABELA INTERNACIONAL (2).pdf
 * Válidos até: 31/12/2025
 */
interface OfficialRow {
  weightMax: number
  label: string
  rates: {
    "EU 1": number
    "EU 2": number
    "EU 3": number
    "NA": number
    "SA": number
    "O1": number
    "O2": number
    "A": number
  }
}

export const OFFICIAL_EXPORT_TARIFF_ROWS: OfficialRow[] = [
  { weightMax: 0.5, label: "Até 0.5 kg", rates: { "EU 1": 11.43, "EU 2": 21.81, "EU 3": 11.87, "NA": 13.29, "SA": 21.28, "O1": 20.03, "O2": 27.81, "A": 53.97 } },
  { weightMax: 1.0, label: "Até 1 kg",   rates: { "EU 1": 14.37, "EU 2": 31.54, "EU 3": 17.30, "NA": 20.64, "SA": 26.03, "O1": 24.63, "O2": 38.78, "A": 54.78 } },
  { weightMax: 1.5, label: "Até 1.5 kg", rates: { "EU 1": 17.74, "EU 2": 35.37, "EU 3": 20.93, "NA": 25.15, "SA": 28.97, "O1": 27.59, "O2": 42.86, "A": 60.55 } },
  { weightMax: 2.0, label: "Até 2 kg",   rates: { "EU 1": 20.87, "EU 2": 40.46, "EU 3": 23.41, "NA": 29.54, "SA": 31.76, "O1": 30.47, "O2": 46.85, "A": 66.28 } },
  { weightMax: 2.5, label: "Até 2.5 kg", rates: { "EU 1": 22.49, "EU 2": 46.81, "EU 3": 25.60, "NA": 34.10, "SA": 34.79, "O1": 33.56, "O2": 51.08, "A": 72.68 } },
  { weightMax: 3.0, label: "Até 3 kg",   rates: { "EU 1": 29.51, "EU 2": 56.05, "EU 3": 40.30, "NA": 35.84, "SA": 51.04, "O1": 42.99, "O2": 64.22, "A": 93.36 } },
  { weightMax: 3.5, label: "Até 3.5 kg", rates: { "EU 1": 31.50, "EU 2": 63.92, "EU 3": 43.73, "NA": 38.94, "SA": 54.25, "O1": 47.20, "O2": 67.96, "A": 104.83 } },
  { weightMax: 4.0, label: "Até 4 kg",   rates: { "EU 1": 33.49, "EU 2": 67.84, "EU 3": 45.99, "NA": 41.81, "SA": 62.02, "O1": 50.60, "O2": 78.82, "A": 110.80 } },
  { weightMax: 4.5, label: "Até 4.5 kg", rates: { "EU 1": 37.48, "EU 2": 71.78, "EU 3": 48.26, "NA": 44.96, "SA": 62.02, "O1": 56.44, "O2": 78.82, "A": 110.80 } },
  { weightMax: 5.0, label: "Até 5 kg",   rates: { "EU 1": 37.46, "EU 2": 75.70, "EU 3": 50.61, "NA": 47.78, "SA": 68.64, "O1": 60.31, "O2": 86.56, "A": 118.10 } },
  { weightMax: 5.5, label: "Até 5.5 kg", rates: { "EU 1": 38.94, "EU 2": 75.70, "EU 3": 52.79, "NA": 52.78, "SA": 75.07, "O1": 63.71, "O2": 93.90, "A": 131.10 } },
  { weightMax: 6.0, label: "Até 6 kg",   rates: { "EU 1": 40.41, "EU 2": 79.45, "EU 3": 55.06, "NA": 54.23, "SA": 81.77, "O1": 67.09, "O2": 101.48, "A": 136.23 } },
  { weightMax: 6.5, label: "Até 6.5 kg", rates: { "EU 1": 41.87, "EU 2": 83.18, "EU 3": 57.32, "NA": 55.86, "SA": 85.95, "O1": 70.49, "O2": 106.64, "A": 141.72 } },
  { weightMax: 7.0, label: "Até 7 kg",   rates: { "EU 1": 43.36, "EU 2": 86.91, "EU 3": 59.59, "NA": 57.31, "SA": 90.10, "O1": 73.87, "O2": 108.96, "A": 146.86 } },
  { weightMax: 7.5, label: "Até 7.5 kg", rates: { "EU 1": 46.69, "EU 2": 90.66, "EU 3": 61.85, "NA": 62.06, "SA": 94.26, "O1": 77.25, "O2": 116.47, "A": 160.47 } },
  { weightMax: 8.0, label: "Até 8 kg",   rates: { "EU 1": 47.92, "EU 2": 94.38, "EU 3": 64.57, "NA": 63.59, "SA": 98.42, "O1": 80.65, "O2": 120.99, "A": 166.03 } },
  { weightMax: 8.5, label: "Até 8.5 kg", rates: { "EU 1": 49.51, "EU 2": 98.13, "EU 3": 66.37, "NA": 66.07, "SA": 102.57, "O1": 84.03, "O2": 114.31, "A": 171.01 } },
  { weightMax: 9.0, label: "Até 9 kg",   rates: { "EU 1": 50.80, "EU 2": 101.87, "EU 3": 68.65, "NA": 68.12, "SA": 106.74, "O1": 87.41, "O2": 118.92, "A": 175.76 } },
  { weightMax: 9.5, label: "Até 9.5 kg", rates: { "EU 1": 52.32, "EU 2": 105.60, "EU 3": 70.92, "NA": 70.84, "SA": 110.89, "O1": 90.81, "O2": 123.55, "A": 180.88 } },
  { weightMax: 10.0, label: "Até 10 kg",  rates: { "EU 1": 53.62, "EU 2": 109.34, "EU 3": 72.20, "NA": 71.97, "SA": 115.04, "O1": 96.02, "O2": 130.68, "A": 186.95 } },
  { weightMax: 10.5, label: "Até 10.5 kg",rates: { "EU 1": 60.88, "EU 2": 112.60, "EU 3": 73.99, "NA": 72.23, "SA": 118.20, "O1": 98.34, "O2": 134.15, "A": 204.70 } },
]

/**
 * Gera a matriz completa de escalões oficiais para as 8 zonas internacionais da Linke
 * Aplica markup padrão sobre o preço de custo base ou preserva a tabela oficial
 */
export function buildOfficialLinkeInternationalZones(markupPct: number = 22): ZonePriceMatrix[] {
  const zoneKeys = ["EU 1", "EU 2", "EU 3", "NA", "SA", "O1", "O2", "A"] as const

  return zoneKeys.map((zCode) => {
    const zoneDef = OFFICIAL_LINKE_ZONES[zCode]
    const tiers: PriceTierLinke[] = OFFICIAL_EXPORT_TARIFF_ROWS.map((row, idx) => {
      const baseCost = row.rates[zCode]
      const sellPrice = Number((baseCost * (1 + markupPct / 100)).toFixed(2))

      return {
        id: `intl_${zCode.toLowerCase().replace(/\s+/g, "_")}_${idx + 1}`,
        label: row.label,
        weight_max: row.weightMax,
        cost_price: baseCost,
        margin_pct: markupPct,
        sell_price: sellPrice,
        delivery_time: zoneDef.transitTime,
        enabled: true,
      }
    })

    // Escalão adicional para peso excedente (> 10.5 kg)
    // Documento: "Cada 0.5 Kg extra: 0.98€" => 1.96€ por kg
    const extraCostPerKg = Number((0.98 * 2).toFixed(2)) // 1.96 € / kg
    const extraSellPerKg = Number((extraCostPerKg * (1 + markupPct / 100)).toFixed(2))

    tiers.push({
      id: `intl_${zCode.toLowerCase().replace(/\s+/g, "_")}_extra`,
      label: "Kg Extra (+10.5kg)",
      weight_max: 999,
      cost_price: extraCostPerKg,
      margin_pct: markupPct,
      sell_price: extraSellPerKg,
      delivery_time: zoneDef.transitTime,
      enabled: true,
    })

    return {
      zone_code: zCode,
      zone_name: zoneDef.name,
      tiers,
    }
  })
}
