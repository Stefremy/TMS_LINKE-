export interface CarrierConfigItem {
  id: string
  name: string
  code: string
  logoUrl: string
  labelLogoUrl?: string
  useCustomLabelLogo?: boolean
  aliases: string[]
  accentColor?: string
}

export interface CarrierLogosSettings {
  carriers: CarrierConfigItem[]
  globalLabelLogoUrl: string
  globalReplaceCorreosLabelLogo: boolean
}

export const DEFAULT_CARRIER_LOGOS_SETTINGS: CarrierLogosSettings = {
  globalLabelLogoUrl: "/linkelabel.png",
  globalReplaceCorreosLabelLogo: true,
  carriers: [
    {
      id: "carrier_ctt",
      name: "CTT Expresso",
      code: "ctt",
      logoUrl: "/logo_transportadoras/ctt_express_logo.svg",
      labelLogoUrl: "/logo_transportadoras/ctt_express_logo.svg",
      useCustomLabelLogo: false,
      aliases: ["ctt", "ctt express", "ctt expresso", "ctt 24h", "ctt 48h", "linke", "forn_2", "2"],
      accentColor: "#da291c"
    },
    {
      id: "carrier_correos",
      name: "Correos Express",
      code: "correos",
      logoUrl: "/logo_transportadoras/correos_logo.jpeg",
      labelLogoUrl: "/linkelabel.png",
      useCustomLabelLogo: true,
      aliases: ["correos", "correos express", "correos.express", "cep ii", "lk003", "forn_lk003"],
      accentColor: "#002e6d"
    },
    {
      id: "carrier_correios",
      name: "CTT Correios (Postal)",
      code: "correios",
      logoUrl: "/logo_transportadoras/ctt_correios_logo.png",
      labelLogoUrl: "/logo_transportadoras/ctt_correios_logo.png",
      useCustomLabelLogo: false,
      aliases: ["correios", "ctt correios", "ctt - correios", "forn_lk000_1"],
      accentColor: "#da291c"
    },
    {
      id: "carrier_dpd",
      name: "DPD Portugal",
      code: "dpd",
      logoUrl: "/logo_transportadoras/dpd_logo.svg",
      labelLogoUrl: "/logo_transportadoras/dpd_logo.svg",
      useCustomLabelLogo: false,
      aliases: ["dpd", "dpd portugal", "dpd group", "lk002", "forn_lk002"],
      accentColor: "#dc0032"
    },
    {
      id: "carrier_mrw",
      name: "MRW",
      code: "mrw",
      logoUrl: "/logo_transportadoras/mrw_logo.jpeg",
      labelLogoUrl: "/logo_transportadoras/mrw_logo.jpeg",
      useCustomLabelLogo: false,
      aliases: ["mrw", "mrw - guimarães", "mrw guimaraes", "lk001", "forn_lk001"],
      accentColor: "#ff6600"
    }
  ]
}
