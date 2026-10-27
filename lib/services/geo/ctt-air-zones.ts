/**
 * CTT Internacional (Outbound), PT Continente — envio aéreo expresso.
 * Transcribed from the country table on page 1 of docs/Cana.pdf.
 * These numbered zones are distinct from the Correos EU 1 / NA / O1 zones.
 * The scan repeats French Guiana; ISO codes below include it only once.
 * Bonaire, Sint Eustatius and Saba share BQ; Saint Helena, Ascension and
 * Tristan da Cunha share SH. Sint Maarten is SX (the Dutch part).
 */
export const CTT_AIR_COUNTRY_NAMES: Readonly<Record<string, string>> = {
  BQ: "Bonaire, Sint Eustatius e Saba",
  SH: "Santa Helena, Ascensão e Tristão da Cunha",
  SX: "Sint Maarten (parte neerlandesa)",
}

export const CTT_AIR_ZONES = [
  {
    code: "Zona 2",
    countries: ["DE", "AT", "BE", "DK", "FR", "GR", "NL", "IE", "IT", "LU", "MC", "GB"],
  },
  {
    code: "Zona 3",
    countries: ["AD", "FI", "GL", "GG", "FO", "IS", "JE", "LI", "MT", "NO", "SE", "CH"],
  },
  {
    code: "Zona 4",
    countries: ["CA", "US"],
  },
  {
    code: "Zona 5",
    countries: [
      "ZA", "AL", "AO", "SA", "DZ", "AR", "AM", "AU", "AZ", "BH", "BY", "BA",
      "BG", "CV", "KZ", "CL", "CY", "KR", "CI", "HR", "EG", "AE", "SK", "SI",
      "EE", "PH", "GE", "GW", "HK", "HU", "FK", "IN", "ID", "IR", "IL", "JP",
      "JO", "XK", "KW", "LV", "LB", "LY", "LT", "MO", "MK", "MY", "MA", "MU",
      "MR", "MX", "MZ", "MD", "ME", "NG", "NZ", "PE", "PL", "KG", "CZ", "RO",
      "RU", "SN", "RS", "SG", "TH", "TW", "TJ", "TL", "TN", "TM", "TR", "UA",
      "UZ", "VE",
    ],
  },
  {
    code: "Zona 6",
    countries: [
      "AF", "AI", "AG", "AW", "BS", "BD", "BB", "BZ", "BJ", "BM", "BO", "BQ",
      "BW", "BN", "BF", "BI", "BT", "CM", "KH", "QA", "TD", "CN", "CO", "KM",
      "CG", "CR", "CU", "CW", "DJ", "DM", "SV", "EC", "ER", "ET", "FJ", "GA",
      "GM", "GH", "GD", "GP", "GU", "GT", "GY", "GF", "GN", "GQ", "HT", "HN",
      "YE", "KY", "CK", "MH", "MP", "NU", "SB", "TC", "VI", "VG", "IQ", "JM",
      "LA", "LS", "LR", "MG", "YT", "MW", "MV", "ML", "MQ", "MM", "FM", "MN",
      "MS", "NA", "NR", "NP", "NI", "NE", "NC", "OM", "PW", "PA", "PG", "PK",
      "PY", "PR", "KE", "KI", "CF", "CD", "DO", "RE", "RW", "WS", "AS", "SM",
      "SH", "LC", "BL", "KN", "ST", "VC", "SC", "SL", "SX",
    ],
  },
  {
    code: "Zona 8",
    countries: ["BR"],
  },
] as const
