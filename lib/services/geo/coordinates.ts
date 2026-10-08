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

  // CTT Centros Operacionais (C.O.) — coordenadas reais por distrito e nó
  "c. o. braganca":                  { lat: 41.806, lng: -6.756, name: "C.O. BRAGANÇA", district: "Bragança" },
  "c. o. bragança":                  { lat: 41.806, lng: -6.756, name: "C.O. BRAGANÇA", district: "Bragança" },
  "c.o. braganca":                   { lat: 41.806, lng: -6.756, name: "C.O. BRAGANÇA", district: "Bragança" },
  "c.o. bragança":                   { lat: 41.806, lng: -6.756, name: "C.O. BRAGANÇA", district: "Bragança" },
  "co braganca":                     { lat: 41.806, lng: -6.756, name: "C.O. BRAGANÇA", district: "Bragança" },
  "co bragança":                     { lat: 41.806, lng: -6.756, name: "C.O. BRAGANÇA", district: "Bragança" },
  "c. o. chaves":                    { lat: 41.740, lng: -7.472, name: "C.O. CHAVES", district: "Vila Real" },
  "c.o. chaves":                     { lat: 41.740, lng: -7.472, name: "C.O. CHAVES", district: "Vila Real" },
  "c. o. mirandela":                 { lat: 41.488, lng: -7.186, name: "C.O. MIRANDELA", district: "Bragança" },
  "c.o. mirandela":                  { lat: 41.488, lng: -7.186, name: "C.O. MIRANDELA", district: "Bragança" },
  "c. o. vila real":                 { lat: 41.300, lng: -7.744, name: "C.O. VILA REAL", district: "Vila Real" },
  "c.o. vila real":                  { lat: 41.300, lng: -7.744, name: "C.O. VILA REAL", district: "Vila Real" },
  "co vila real":                    { lat: 41.300, lng: -7.744, name: "C.O. VILA REAL", district: "Vila Real" },
  "c. o. viana":                     { lat: 41.691, lng: -8.834, name: "C.O. VIANA DO CASTELO", district: "Viana do Castelo" },
  "c.o. viana":                      { lat: 41.691, lng: -8.834, name: "C.O. VIANA DO CASTELO", district: "Viana do Castelo" },
  "c. o. viana do castelo":          { lat: 41.691, lng: -8.834, name: "C.O. VIANA DO CASTELO", district: "Viana do Castelo" },
  "c.o. viana do castelo":           { lat: 41.691, lng: -8.834, name: "C.O. VIANA DO CASTELO", district: "Viana do Castelo" },
  "c. o. braga":                     { lat: 41.516, lng: -8.441, name: "C.O. BRAGA", district: "Braga" },
  "c.o. braga":                      { lat: 41.516, lng: -8.441, name: "C.O. BRAGA", district: "Braga" },
  "co braga":                        { lat: 41.516, lng: -8.441, name: "C.O. BRAGA", district: "Braga" },
  "c.o. braga (obr)":                { lat: 41.516, lng: -8.441, name: "C.O. BRAGA (OBR)", district: "Braga" },
  "c. o. braga (obr)":               { lat: 41.516, lng: -8.441, name: "C.O. BRAGA (OBR)", district: "Braga" },
  "c. o. guimaraes":                 { lat: 41.442, lng: -8.291, name: "C.O. GUIMARÃES", district: "Braga" },
  "c.o. guimaraes":                  { lat: 41.442, lng: -8.291, name: "C.O. GUIMARÃES", district: "Braga" },
  "c. o. guimarães":                 { lat: 41.442, lng: -8.291, name: "C.O. GUIMARÃES", district: "Braga" },
  "c.o. guimarães":                  { lat: 41.442, lng: -8.291, name: "C.O. GUIMARÃES", district: "Braga" },
  "c. o. perafita":                  { lat: 41.222, lng: -8.712, name: "C.O. PERAFITA", district: "Matosinhos" },
  "c.o. perafita":                   { lat: 41.222, lng: -8.712, name: "C.O. PERAFITA", district: "Matosinhos" },
  "co perafita":                     { lat: 41.222, lng: -8.712, name: "C.O. PERAFITA", district: "Matosinhos" },
  "perafita":                        { lat: 41.222, lng: -8.712, name: "C.O. PERAFITA", district: "Matosinhos" },
  "c. o. porto":                     { lat: 41.229, lng: -8.621, name: "C.O. PORTO (MAIA)", district: "Porto" },
  "c.o. porto":                      { lat: 41.229, lng: -8.621, name: "C.O. PORTO (MAIA)", district: "Porto" },
  "co porto":                        { lat: 41.229, lng: -8.621, name: "C.O. PORTO (MAIA)", district: "Porto" },
  "c. o. aveiro":                    { lat: 40.640, lng: -8.653, name: "C.O. AVEIRO", district: "Aveiro" },
  "c.o. aveiro":                     { lat: 40.640, lng: -8.653, name: "C.O. AVEIRO", district: "Aveiro" },
  "co aveiro":                       { lat: 40.640, lng: -8.653, name: "C.O. AVEIRO", district: "Aveiro" },
  "c. o. viseu":                     { lat: 40.656, lng: -7.912, name: "C.O. VISEU", district: "Viseu" },
  "c.o. viseu":                      { lat: 40.656, lng: -7.912, name: "C.O. VISEU", district: "Viseu" },
  "co viseu":                        { lat: 40.656, lng: -7.912, name: "C.O. VISEU", district: "Viseu" },
  "c. o. guarda":                    { lat: 40.537, lng: -7.268, name: "C.O. GUARDA", district: "Guarda" },
  "c.o. guarda":                     { lat: 40.537, lng: -7.268, name: "C.O. GUARDA", district: "Guarda" },
  "co guarda":                       { lat: 40.537, lng: -7.268, name: "C.O. GUARDA", district: "Guarda" },
  "c. o. coimbra":                   { lat: 40.231, lng: -8.435, name: "C.O. COIMBRA", district: "Coimbra" },
  "c.o. coimbra":                    { lat: 40.231, lng: -8.435, name: "C.O. COIMBRA", district: "Coimbra" },
  "co coimbra":                      { lat: 40.231, lng: -8.435, name: "C.O. COIMBRA", district: "Coimbra" },
  "c. o. castelo branco":            { lat: 39.822, lng: -7.493, name: "C.O. CASTELO BRANCO", district: "Castelo Branco" },
  "c.o. castelo branco":             { lat: 39.822, lng: -7.493, name: "C.O. CASTELO BRANCO", district: "Castelo Branco" },
  "c. o. leiria":                    { lat: 39.743, lng: -8.807, name: "C.O. LEIRIA", district: "Leiria" },
  "c.o. leiria":                     { lat: 39.743, lng: -8.807, name: "C.O. LEIRIA", district: "Leiria" },
  "co leiria":                       { lat: 39.743, lng: -8.807, name: "C.O. LEIRIA", district: "Leiria" },
  "c. o. santarem":                  { lat: 39.236, lng: -8.685, name: "C.O. SANTARÉM", district: "Santarém" },
  "c. o. santarém":                  { lat: 39.236, lng: -8.685, name: "C.O. SANTARÉM", district: "Santarém" },
  "c.o. santarem":                   { lat: 39.236, lng: -8.685, name: "C.O. SANTARÉM", district: "Santarém" },
  "c.o. santarém":                   { lat: 39.236, lng: -8.685, name: "C.O. SANTARÉM", district: "Santarém" },
  "c. o. portalegre":                { lat: 39.293, lng: -7.431, name: "C.O. PORTALEGRE", district: "Portalegre" },
  "c.o. portalegre":                 { lat: 39.293, lng: -7.431, name: "C.O. PORTALEGRE", district: "Portalegre" },
  "c. o. lisboa":                    { lat: 38.784, lng: -9.125, name: "C.O. LISBOA", district: "Lisboa" },
  "c.o. lisboa":                     { lat: 38.784, lng: -9.125, name: "C.O. LISBOA", district: "Lisboa" },
  "co lisboa":                       { lat: 38.784, lng: -9.125, name: "C.O. LISBOA", district: "Lisboa" },
  "c. o. setubal":                   { lat: 38.524, lng: -8.893, name: "C.O. SETÚBAL", district: "Setúbal" },
  "c.o. setubal":                    { lat: 38.524, lng: -8.893, name: "C.O. SETÚBAL", district: "Setúbal" },
  "c. o. setúbal":                   { lat: 38.524, lng: -8.893, name: "C.O. SETÚBAL", district: "Setúbal" },
  "c.o. setúbal":                    { lat: 38.524, lng: -8.893, name: "C.O. SETÚBAL", district: "Setúbal" },
  "c. o. evora":                     { lat: 38.571, lng: -7.907, name: "C.O. ÉVORA", district: "Évora" },
  "c. o. évora":                     { lat: 38.571, lng: -7.907, name: "C.O. ÉVORA", district: "Évora" },
  "c.o. evora":                      { lat: 38.571, lng: -7.907, name: "C.O. ÉVORA", district: "Évora" },
  "c.o. évora":                      { lat: 38.571, lng: -7.907, name: "C.O. ÉVORA", district: "Évora" },
  "c. o. beja":                      { lat: 38.015, lng: -7.863, name: "C.O. BEJA", district: "Beja" },
  "c.o. beja":                       { lat: 38.015, lng: -7.863, name: "C.O. BEJA", district: "Beja" },
  "co beja":                         { lat: 38.015, lng: -7.863, name: "C.O. BEJA", district: "Beja" },
  // CTT Algarve Centros Operacionais
  "c. o. faro":                      { lat: 37.019, lng: -7.930, name: "C.O. FARO", district: "Faro" },
  "c.o. faro":                       { lat: 37.019, lng: -7.930, name: "C.O. FARO", district: "Faro" },
  "co faro":                         { lat: 37.019, lng: -7.930, name: "C.O. FARO", district: "Faro" },
  "c. o. portimao":                  { lat: 37.138, lng: -8.537, name: "C.O. PORTIMÃO", district: "Faro" },
  "c. o. portimão":                  { lat: 37.138, lng: -8.537, name: "C.O. PORTIMÃO", district: "Faro" },
  "c.o. portimao":                   { lat: 37.138, lng: -8.537, name: "C.O. PORTIMÃO", district: "Faro" },
  "c.o. portimão":                   { lat: 37.138, lng: -8.537, name: "C.O. PORTIMÃO", district: "Faro" },
  "c. o. loule":                     { lat: 37.138, lng: -8.022, name: "C.O. LOULÉ", district: "Faro" },
  "c. o. loulé":                     { lat: 37.138, lng: -8.022, name: "C.O. LOULÉ", district: "Faro" },
  "c.o. loule":                      { lat: 37.138, lng: -8.022, name: "C.O. LOULÉ", district: "Faro" },
  "c.o. loulé":                      { lat: 37.138, lng: -8.022, name: "C.O. LOULÉ", district: "Faro" },
  "c. o. albufeira":                 { lat: 37.089, lng: -8.247, name: "C.O. ALBUFEIRA", district: "Faro" },
  "c.o. albufeira":                  { lat: 37.089, lng: -8.247, name: "C.O. ALBUFEIRA", district: "Faro" },
  "c. o. olhao":                     { lat: 37.028, lng: -7.841, name: "C.O. OLHÃO", district: "Faro" },
  "c. o. olhão":                     { lat: 37.028, lng: -7.841, name: "C.O. OLHÃO", district: "Faro" },
  "c.o. olhao":                      { lat: 37.028, lng: -7.841, name: "C.O. OLHÃO", district: "Faro" },
  "c.o. olhão":                      { lat: 37.028, lng: -7.841, name: "C.O. OLHÃO", district: "Faro" },
  "c. o. tavira":                    { lat: 37.126, lng: -7.649, name: "C.O. TAVIRA", district: "Faro" },
  "c.o. tavira":                     { lat: 37.126, lng: -7.649, name: "C.O. TAVIRA", district: "Faro" },
  "c. o. lagos":                     { lat: 37.102, lng: -8.674, name: "C.O. LAGOS", district: "Faro" },
  "c.o. lagos":                      { lat: 37.102, lng: -8.674, name: "C.O. LAGOS", district: "Faro" },
  "c. o. vila real de santo antonio":{ lat: 37.194, lng: -7.416, name: "C.O. VILA REAL DE SANTO ANTÓNIO", district: "Faro" },
  "c. o. vila real de santo antónio":{ lat: 37.194, lng: -7.416, name: "C.O. VILA REAL DE SANTO ANTÓNIO", district: "Faro" },
  "c.o. vila real de santo antonio": { lat: 37.194, lng: -7.416, name: "C.O. VILA REAL DE SANTO ANTÓNIO", district: "Faro" },
  "c.o. vila real de santo antónio": { lat: 37.194, lng: -7.416, name: "C.O. VILA REAL DE SANTO ANTÓNIO", district: "Faro" },
  // Nós Cliente / generic hub nodes
  "nó cliente":                      { lat: 41.244, lng: -8.680, name: "Nó Cliente (Porto Norte)", district: "Porto" },
  "no cliente":                      { lat: 41.244, lng: -8.680, name: "Nó Cliente (Porto Norte)", district: "Porto" },
  "nó de cliente":                   { lat: 41.244, lng: -8.680, name: "Nó Cliente (Porto Norte)", district: "Porto" },

  // Portuguese Districts / Major Cities (18 Mainland Districts)
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

  // Trás-os-Montes & Alto Douro
  "chaves": { lat: 41.740, lng: -7.472, name: "Chaves", district: "Vila Real" },
  "mirandela": { lat: 41.488, lng: -7.186, name: "Mirandela", district: "Bragança" },
  "macedo de cavaleiros": { lat: 41.538, lng: -6.963, name: "Macedo de Cavaleiros", district: "Bragança" },
  "valpaços": { lat: 41.606, lng: -7.310, name: "Valpaços", district: "Vila Real" },
  "valpacos": { lat: 41.606, lng: -7.310, name: "Valpaços", district: "Vila Real" },
  "vinhais": { lat: 41.834, lng: -7.004, name: "Vinhais", district: "Bragança" },
  "mogadouro": { lat: 41.340, lng: -6.716, name: "Mogadouro", district: "Bragança" },
  "miranda do douro": { lat: 41.494, lng: -6.273, name: "Miranda do Douro", district: "Bragança" },
  "lamego": { lat: 41.097, lng: -7.810, name: "Lamego", district: "Viseu" },
  "peso da régua": { lat: 41.164, lng: -7.788, name: "Peso da Régua", district: "Vila Real" },
  "peso da regua": { lat: 41.164, lng: -7.788, name: "Peso da Régua", district: "Vila Real" },

  // Algarve (Todos os 16 concelhos)
  "albufeira": { lat: 37.089, lng: -8.247, name: "Albufeira", district: "Faro" },
  "portimão": { lat: 37.138, lng: -8.537, name: "Portimão", district: "Faro" },
  "portimao": { lat: 37.138, lng: -8.537, name: "Portimão", district: "Faro" },
  "loulé": { lat: 37.138, lng: -8.022, name: "Loulé", district: "Faro" },
  "loule": { lat: 37.138, lng: -8.022, name: "Loulé", district: "Faro" },
  "quarteira": { lat: 37.078, lng: -8.102, name: "Quarteira", district: "Faro" },
  "olhão": { lat: 37.028, lng: -7.841, name: "Olhão", district: "Faro" },
  "olhao": { lat: 37.028, lng: -7.841, name: "Olhão", district: "Faro" },
  "tavira": { lat: 37.126, lng: -7.649, name: "Tavira", district: "Faro" },
  "lagos": { lat: 37.102, lng: -8.674, name: "Lagos", district: "Faro" },
  "silves": { lat: 37.189, lng: -8.440, name: "Silves", district: "Faro" },
  "lagoa": { lat: 37.136, lng: -8.453, name: "Lagoa", district: "Faro" },
  "vila real de santo antónio": { lat: 37.194, lng: -7.416, name: "Vila Real de Santo António", district: "Faro" },
  "vila real de santo antonio": { lat: 37.194, lng: -7.416, name: "Vila Real de Santo António", district: "Faro" },
  "castro marim": { lat: 37.218, lng: -7.443, name: "Castro Marim", district: "Faro" },
  "são brás de alportel": { lat: 37.153, lng: -7.887, name: "São Brás de Alportel", district: "Faro" },
  "sao bras de alportel": { lat: 37.153, lng: -7.887, name: "São Brás de Alportel", district: "Faro" },
  "aljezur": { lat: 37.319, lng: -8.803, name: "Aljezur", district: "Faro" },
  "monchique": { lat: 37.317, lng: -8.555, name: "Monchique", district: "Faro" },
  "vila do bispo": { lat: 37.082, lng: -8.911, name: "Vila do Bispo", district: "Faro" },
  "sagres": { lat: 37.013, lng: -8.939, name: "Sagres", district: "Faro" },
  "alcoutim": { lat: 37.471, lng: -7.472, name: "Alcoutim", district: "Faro" },

  // Alentejo
  "sines": { lat: 37.956, lng: -8.864, name: "Sines", district: "Setúbal" },
  "santiago do cacém": { lat: 38.016, lng: -8.697, name: "Santiago do Cacém", district: "Setúbal" },
  "santiago do cacem": { lat: 38.016, lng: -8.697, name: "Santiago do Cacém", district: "Setúbal" },
  "grândola": { lat: 38.176, lng: -8.567, name: "Grândola", district: "Setúbal" },
  "grandola": { lat: 38.176, lng: -8.567, name: "Grândola", district: "Setúbal" },
  "alcácer do sal": { lat: 38.373, lng: -8.514, name: "Alcácer do Sal", district: "Setúbal" },
  "alcacer do sal": { lat: 38.373, lng: -8.514, name: "Alcácer do Sal", district: "Setúbal" },
  "elvas": { lat: 38.882, lng: -7.163, name: "Elvas", district: "Portalegre" },
  "estremoz": { lat: 38.843, lng: -7.587, name: "Estremoz", district: "Évora" },
  "ponte de sor": { lat: 39.249, lng: -8.013, name: "Ponte de Sor", district: "Portalegre" },
  "aljustrel": { lat: 37.876, lng: -8.163, name: "Aljustrel", district: "Beja" },
  "castro verde": { lat: 37.701, lng: -8.084, name: "Castro Verde", district: "Beja" },
  "odemira": { lat: 37.597, lng: -8.643, name: "Odemira", district: "Beja" },
  "moura": { lat: 38.140, lng: -7.502, name: "Moura", district: "Beja" },
  "serpa": { lat: 37.944, lng: -7.598, name: "Serpa", district: "Beja" },

  // Centro / Ribatejo / Beiras
  "tomar": { lat: 39.603, lng: -8.411, name: "Tomar", district: "Santarém" },
  "abrantes": { lat: 39.463, lng: -8.199, name: "Abrantes", district: "Santarém" },
  "torres novas": { lat: 39.480, lng: -8.539, name: "Torres Novas", district: "Santarém" },
  "entroncamento": { lat: 39.465, lng: -8.469, name: "Entroncamento", district: "Santarém" },
  "covilhã": { lat: 40.283, lng: -7.504, name: "Covilhã", district: "Castelo Branco" },
  "covilha": { lat: 40.283, lng: -7.504, name: "Covilhã", district: "Castelo Branco" },
  "fundão": { lat: 40.140, lng: -7.501, name: "Fundão", district: "Castelo Branco" },
  "fundao": { lat: 40.140, lng: -7.501, name: "Fundão", district: "Castelo Branco" },
  "seia": { lat: 40.420, lng: -7.703, name: "Seia", district: "Guarda" },
  "gouveia": { lat: 40.494, lng: -7.593, name: "Gouveia", district: "Guarda" },
  "pombal": { lat: 39.917, lng: -8.628, name: "Pombal", district: "Leiria" },
  "marinha grande": { lat: 39.750, lng: -8.933, name: "Marinha Grande", district: "Leiria" },
  "nazaré": { lat: 39.601, lng: -9.071, name: "Nazaré", district: "Leiria" },
  "nazare": { lat: 39.601, lng: -9.071, name: "Nazaré", district: "Leiria" },
  "peniche": { lat: 39.356, lng: -9.381, name: "Peniche", district: "Leiria" },
  "caldas da rainha": { lat: 39.404, lng: -9.136, name: "Caldas da Rainha", district: "Leiria" },
  "alcobaça": { lat: 39.549, lng: -8.979, name: "Alcobaça", district: "Leiria" },
  "alcobaca": { lat: 39.549, lng: -8.979, name: "Alcobaça", district: "Leiria" },
  "rio maior": { lat: 39.336, lng: -8.937, name: "Rio Maior", district: "Santarém" },
  "cartaxo": { lat: 39.160, lng: -8.787, name: "Cartaxo", district: "Santarém" },
  "alenquer": { lat: 39.053, lng: -9.009, name: "Alenquer", district: "Lisboa" },
  "carregado": { lat: 39.022, lng: -8.974, name: "Carregado (Plataforma Logística)", district: "Lisboa" },
  "azambuja": { lat: 39.069, lng: -8.868, name: "Azambuja (Polo Logístico)", district: "Lisboa" },
  "alverca": { lat: 38.899, lng: -9.040, name: "Alverca do Ribatejo", district: "Lisboa" },
  "vila franca de xira": { lat: 38.955, lng: -8.989, name: "Vila Franca de Xira", district: "Lisboa" },
  "torres vedras": { lat: 39.092, lng: -9.260, name: "Torres Vedras", district: "Lisboa" },
  "figueira da foz": { lat: 40.150, lng: -8.861, name: "Figueira da Foz", district: "Coimbra" },
  "mealhada": { lat: 40.378, lng: -8.452, name: "Mealhada", district: "Aveiro" },
  "cantanhede": { lat: 40.347, lng: -8.594, name: "Cantanhede", district: "Coimbra" },
  "montemor-o-velho": { lat: 40.174, lng: -8.683, name: "Montemor-o-Velho", district: "Coimbra" },
  "lousã": { lat: 40.110, lng: -8.246, name: "Lousã", district: "Coimbra" },
  "lousa": { lat: 40.110, lng: -8.246, name: "Lousã", district: "Coimbra" },

  // Key Sub-municipalities & Industrial Parks Norte / Centro / Sul
  "maia": { lat: 41.229, lng: -8.621, name: "Maia", district: "Porto" },
  "vila nova de gaia": { lat: 41.133, lng: -8.616, name: "Vila Nova de Gaia", district: "Porto" },
  "gaia": { lat: 41.133, lng: -8.616, name: "Vila Nova de Gaia", district: "Porto" },
  "matosinhos": { lat: 41.184, lng: -8.696, name: "Matosinhos", district: "Porto" },
  "sintra": { lat: 38.802, lng: -9.381, name: "Sintra", district: "Lisboa" },
  "cascais": { lat: 38.697, lng: -9.422, name: "Cascais", district: "Lisboa" },
  "loures": { lat: 38.831, lng: -9.167, name: "Loures", district: "Lisboa" },
  "odivelas": { lat: 38.795, lng: -9.183, name: "Odivelas", district: "Lisboa" },
  "amadora": { lat: 38.759, lng: -9.224, name: "Amadora", district: "Lisboa" },
  "oeiras": { lat: 38.697, lng: -9.311, name: "Oeiras", district: "Lisboa" },
  "almada": { lat: 38.680, lng: -9.158, name: "Almada", district: "Setúbal" },
  "seixal": { lat: 38.643, lng: -9.102, name: "Seixal", district: "Setúbal" },
  "barreiro": { lat: 38.663, lng: -9.072, name: "Barreiro", district: "Setúbal" },
  "montijo": { lat: 38.706, lng: -8.974, name: "Montijo", district: "Setúbal" },
  "palmela": { lat: 38.567, lng: -8.903, name: "Palmela", district: "Setúbal" },
  "guimarães": { lat: 41.442, lng: -8.291, name: "Guimarães", district: "Braga" },
  "guimaraes": { lat: 41.442, lng: -8.291, name: "Guimarães", district: "Braga" },
  "famalicão": { lat: 41.408, lng: -8.519, name: "Vila Nova de Famalicão", district: "Braga" },
  "famalicao": { lat: 41.408, lng: -8.519, name: "Vila Nova de Famalicão", district: "Braga" },
  "barcelos": { lat: 41.531, lng: -8.618, name: "Barcelos", district: "Braga" },
  "esposende": { lat: 41.533, lng: -8.781, name: "Esposende", district: "Braga" },
  "vila do conde": { lat: 41.355, lng: -8.744, name: "Vila do Conde", district: "Porto" },
  "póvoa de varzim": { lat: 41.383, lng: -8.762, name: "Póvoa de Varzim", district: "Porto" },
  "povoa de varzim": { lat: 41.383, lng: -8.762, name: "Póvoa de Varzim", district: "Porto" },
  "trofa": { lat: 41.336, lng: -8.560, name: "Trofa", district: "Porto" },
  "santo tirso": { lat: 41.343, lng: -8.474, name: "Santo Tirso", district: "Porto" },
  "valongo": { lat: 41.190, lng: -8.498, name: "Valongo", district: "Porto" },
  "gondomar": { lat: 41.144, lng: -8.532, name: "Gondomar", district: "Porto" },
  "penafiel": { lat: 41.206, lng: -8.284, name: "Penafiel", district: "Porto" },
  "paredes": { lat: 41.208, lng: -8.331, name: "Paredes", district: "Porto" },
  "felgueiras": { lat: 41.367, lng: -8.199, name: "Felgueiras", district: "Porto" },
  "amarante": { lat: 41.269, lng: -8.078, name: "Amarante", district: "Porto" },
  "santa maria da feira": { lat: 40.925, lng: -8.543, name: "Santa Maria da Feira", district: "Aveiro" },
  "são joão da madeira": { lat: 40.902, lng: -8.490, name: "São João da Madeira", district: "Aveiro" },
  "sao joao da madeira": { lat: 40.902, lng: -8.490, name: "São João da Madeira", district: "Aveiro" },
  "ovar": { lat: 40.859, lng: -8.625, name: "Ovar", district: "Aveiro" },
  "águeda": { lat: 40.575, lng: -8.444, name: "Águeda", district: "Aveiro" },
  "agueda": { lat: 40.575, lng: -8.444, name: "Águeda", district: "Aveiro" },
  "ílhavo": { lat: 40.601, lng: -8.667, name: "Ílhavo", district: "Aveiro" },
  "ilhavo": { lat: 40.601, lng: -8.667, name: "Ílhavo", district: "Aveiro" },

  // Ilhas (Regiões Autónomas)
  "funchal": { lat: 32.650, lng: -16.908, name: "Funchal", district: "Madeira" },
  "ponta delgada": { lat: 37.741, lng: -25.675, name: "Ponta Delgada", district: "Açores" },
  "angra do heroísmo": { lat: 38.654, lng: -27.218, name: "Angra do Heroísmo", district: "Açores" },

  // Espanha
  "madrid": { lat: 40.416, lng: -3.703, name: "Madrid", district: "Comunidad de Madrid" },
  "barcelona": { lat: 41.387, lng: 2.168, name: "Barcelona", district: "Cataluña" },
  "valencia": { lat: 39.469, lng: -0.376, name: "Valencia", district: "Comunidad Valenciana" },
  "sevilla": { lat: 37.389, lng: -5.984, name: "Sevilla", district: "Andalucía" },
  "badajoz": { lat: 38.879, lng: -6.970, name: "Badajoz", district: "Extremadura" },
  "vigo": { lat: 42.240, lng: -8.720, name: "Vigo", district: "Galicia" },
}

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function cleanOperationalPrefix(s: string): string {
  return s
    .replace(/^(c\.?\s*o\.?|co|ctc|cd|cdp|hub|centro operacional|centro de tratamento|plataforma|cais|delegação|posto)\s+/i, "")
    .trim()
}

function matchesWholeWord(text: string, word: string): boolean {
  if (!text || !word) return false
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(^|[^a-z0-9áàâãéèêíóòôõúç])${escaped}(?![a-z0-9áàâãéèêíóòôõúç])`, "i")
  return regex.test(text)
}

// Sorted by key length descending so longer specific matches take precedence
const SORTED_KNOWN_ENTRIES = Object.entries(KNOWN_LOCATIONS).sort(
  (a, b) => b[0].length - a[0].length
)

/**
 * Resolve geographic coordinate from city name, hub name, or postal code
 */
export function resolveLocationCoordinate(
  query?: string | null,
  postalCode?: string | null
): GeoCoordinate {
  const raw = (query || "").trim()
  if (!raw && !postalCode) {
    return { lat: 39.5, lng: -8.5, name: "Portugal Central" }
  }

  // 1. If query is a CTT tracking event text with parenthesized facility:
  // e.g. "Recolha Efetuada (C. O. BRAGA)" or "Expedição Nacional (C.O. BRAGA (OBR))"
  const parenMatch = raw.match(/\(([^)]+)\)[^()]*$/)
  const candidateFromParen = parenMatch && parenMatch[1] ? parenMatch[1].trim() : null
  const candidatesToCheck = candidateFromParen ? [candidateFromParen, raw] : [raw]

  for (const c of candidatesToCheck) {
    const cLower = c.toLowerCase()
    const cStripped = stripAccents(c)
    const cCleaned = cleanOperationalPrefix(cLower)
    const cCleanedStripped = stripAccents(cCleaned)

    // Direct exact match
    if (KNOWN_LOCATIONS[cLower]) return KNOWN_LOCATIONS[cLower]
    if (KNOWN_LOCATIONS[cStripped]) return KNOWN_LOCATIONS[cStripped]
    if (KNOWN_LOCATIONS[cCleaned]) return KNOWN_LOCATIONS[cCleaned]
    if (KNOWN_LOCATIONS[cCleanedStripped]) return KNOWN_LOCATIONS[cCleanedStripped]

    // Whole-word match against sorted entries (longer keys tested first)
    for (const [key, val] of SORTED_KNOWN_ENTRIES) {
      const keyStripped = stripAccents(key)
      if (matchesWholeWord(cLower, key) || matchesWholeWord(cStripped, keyStripped)) {
        return val
      }
      if (matchesWholeWord(cCleaned, key) || matchesWholeWord(cCleanedStripped, keyStripped)) {
        return val
      }
    }
  }

  // 2. Fallback based on Postal Code prefix (First 2 digits - regions of Portugal)
  const cleanCode = (postalCode || "").trim().replace(/\D/g, "")
  if (cleanCode.length >= 2) {
    const prefix = cleanCode.substring(0, 2)
    switch (prefix) {
      // Lisboa & Grande Lisboa
      case "10": case "11": case "12": case "13": case "14":
      case "15": case "16": case "17": case "18": case "19":
        return KNOWN_LOCATIONS["lisboa"]
      case "26": case "27":
        return KNOWN_LOCATIONS["loures"]

      // Ribatejo / Oeste
      case "20": case "21": case "22": case "23":
        return KNOWN_LOCATIONS["santarém"]
      case "24": case "25":
        return KNOWN_LOCATIONS["leiria"]

      // Península de Setúbal
      case "28": case "29":
        return KNOWN_LOCATIONS["setúbal"]

      // Centro
      case "30": case "31": case "32": case "33": case "34":
        return KNOWN_LOCATIONS["coimbra"]
      case "35": case "36":
        return KNOWN_LOCATIONS["viseu"]
      case "37": case "38":
        return KNOWN_LOCATIONS["aveiro"]

      // Porto & Grande Porto
      case "40": case "41": case "42": case "43":
        return KNOWN_LOCATIONS["porto"]
      case "44": case "45":
        return KNOWN_LOCATIONS["maia"]

      // Minho
      case "47": case "48":
        return KNOWN_LOCATIONS["braga"]
      case "49":
        return KNOWN_LOCATIONS["viana do castelo"]

      // Trás-os-Montes & Alto Douro
      case "50": case "51":
        return KNOWN_LOCATIONS["vila real"]
      case "52":
        return KNOWN_LOCATIONS["miranda do douro"]
      case "53":
        return KNOWN_LOCATIONS["bragança"]
      case "54":
        return KNOWN_LOCATIONS["chaves"]

      // Beira Interior
      case "60": case "61": case "62":
        return KNOWN_LOCATIONS["castelo branco"]
      case "63": case "64":
        return KNOWN_LOCATIONS["guarda"]

      // Alentejo
      case "70": case "71": case "72":
        return KNOWN_LOCATIONS["évora"]
      case "73": case "74":
        return KNOWN_LOCATIONS["portalegre"]
      case "75": case "76": case "77": case "78":
        return KNOWN_LOCATIONS["beja"]

      // Algarve (Mapeamento Concelhio Exato)
      case "80":
        return KNOWN_LOCATIONS["faro"]
      case "81":
        return KNOWN_LOCATIONS["loulé"]
      case "82":
        return KNOWN_LOCATIONS["albufeira"]
      case "83":
        return KNOWN_LOCATIONS["silves"]
      case "84":
        return KNOWN_LOCATIONS["lagoa"]
      case "85":
        return KNOWN_LOCATIONS["portimão"]
      case "86":
        return KNOWN_LOCATIONS["lagos"]
      case "87":
        return KNOWN_LOCATIONS["olhão"]
      case "88":
        return KNOWN_LOCATIONS["tavira"]
      case "89":
        return KNOWN_LOCATIONS["vila real de santo antónio"]

      // Ilhas
      case "90": case "91": case "92": case "93": case "94":
        return KNOWN_LOCATIONS["funchal"]
      case "95": case "96": case "97": case "98": case "99":
        return KNOWN_LOCATIONS["ponta delgada"]
    }
  }

  // Default fallback: Central Portugal
  return { lat: 39.5, lng: -8.5, name: query || "Portugal Central" }
}
