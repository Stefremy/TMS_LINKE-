export interface EmojiCategory {
  name: string
  icon: string
  emojis: { char: string; keywords: string }[]
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Populares & Trabalho",
    icon: "⭐",
    emojis: [
      { char: "👍", keywords: "fixe bom sim ok like joinha positivo" },
      { char: "👏", keywords: "palmas parabens muito bem top" },
      { char: "📦", keywords: "encomenda caixa pacote recolha envio" },
      { char: "🚚", keywords: "camiao carrinha transporte entrega estafeta correio" },
      { char: "🚀", keywords: "foguete rapido voar launch sucesso" },
      { char: "✅", keywords: "feito concluido certo ok validado" },
      { char: "⚠️", keywords: "aviso atencao alerta cuidado perigo" },
      { char: "🚨", keywords: "urgente sirene emergencia problema alerta" },
      { char: "🔥", keywords: "fogo incrivel top quente sucesso" },
      { char: "🎉", keywords: "festa parabens comemorar confetis" },
      { char: "🤝", keywords: "acordo aperto mao negocio parceria equipa" },
      { char: "💪", keywords: "forca vamos equipa poder capacidade" },
      { char: "⏱️", keywords: "relogio tempo cronometro prazo horas" },
      { char: "📋", keywords: "lista tarefas prancheta guia documento" },
      { char: "📍", keywords: "localizacao ponto morada gps destino" },
      { char: "☕", keywords: "cafe pausa energia manha descanso" },
    ],
  },
  {
    name: "Expressões",
    icon: "😀",
    emojis: [
      { char: "😀", keywords: "sorriso feliz contente alegre" },
      { char: "😂", keywords: "rir riso chorar de rir graca" },
      { char: "🤣", keywords: "gargalhada rir muito rebolar" },
      { char: "😊", keywords: "sorriso fofo simpatico obrigado" },
      { char: "😎", keywords: "oculos fixe estilo patrão" },
      { char: "🥳", keywords: "festa celebrar aniversario alegria" },
      { char: "🤔", keywords: "pensar duvida questao analisar" },
      { char: "😅", keywords: "alivio suor sorriso nervoso ufa" },
      { char: "🙌", keywords: "celebrar maos ao ar viva gracas" },
      { char: "🙏", keywords: "por favor obrigado rezar agradeco" },
      { char: "👌", keywords: "perfeito ok certo combinado" },
      { char: "👀", keywords: "olhos ver atento olhar espreitar" },
      { char: "💡", keywords: "ideia luz solucao novidade" },
      { char: "🎯", keywords: "alvo objetivo meta certeiro acertou" },
      { char: "💯", keywords: "cem perfeito pontuacao maximo" },
      { char: "❤️", keywords: "coracao amor gosto adoro" },
    ],
  },
  {
    name: "Operações & Logística",
    icon: "📦",
    emojis: [
      { char: "🏷️", keywords: "etiqueta label preco codigo" },
      { char: "📫", keywords: "correio marco carta recebida ctt" },
      { char: "📬", keywords: "correio caixa entrada aberta" },
      { char: "📭", keywords: "correio vazio caixa" },
      { char: "📄", keywords: "folha documento guia fatura pdf" },
      { char: "📁", keywords: "pasta ficheiro arquivo dossier" },
      { char: "🏢", keywords: "empresa escritorio armazem sede" },
      { char: "🏬", keywords: "loja armazem armazens" },
      { char: "🛣️", keywords: "estrada via autoestrada transito rota" },
      { char: "🚗", keywords: "carro viatura automovel transporte" },
      { char: "🛵", keywords: "mota estafeta expresso rapido" },
      { char: "✈️", keywords: "aviao aereo internacional envio" },
      { char: "🚢", keywords: "barco navio maritimo ilhas carga" },
      { char: "🔍", keywords: "procurar pesquisa rastreio tracking encontrar" },
      { char: "📊", keywords: "grafico estatisticas relatorio numeros faturacao" },
      { char: "💰", keywords: "dinheiro valor euros saldo tesouraria pagamento" },
    ],
  },
]

export interface GifItem {
  id: string
  title: string
  url: string
  previewUrl: string
  category: string
  tags: string[]
}

export const CURATED_GIFS: GifItem[] = [
  // Sucesso & Celebração
  {
    id: "g1",
    title: "Sucesso / Celebração",
    url: "https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif",
    previewUrl: "https://media.giphy.com/media/26u4cqiYI30juCOGY/200w.gif",
    category: "Celebração",
    tags: ["sucesso", "festa", "celebrar", "vamos", "conseguimos", "top"],
  },
  {
    id: "g2",
    title: "Aplausos / Muito bom",
    url: "https://media.giphy.com/media/ely3apij36BJhoZ234/giphy.gif",
    previewUrl: "https://media.giphy.com/media/ely3apij36BJhoZ234/200w.gif",
    category: "Celebração",
    tags: ["aplausos", "parabens", "bravo", "top", "bom trabalho"],
  },
  {
    id: "g3",
    title: "High Five / Equipa",
    url: "https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/200w.gif",
    category: "Equipa",
    tags: ["high five", "equipa", "parceria", "juntos", "forca"],
  },
  // Trabalho & Foco
  {
    id: "g4",
    title: "A trabalhar a fundo / Typing fast",
    url: "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif",
    previewUrl: "https://media.giphy.com/media/unQ3IJU2RG7DO/200w.gif",
    category: "Trabalho",
    tags: ["trabalho", "teclado", "ocupado", "foco", "a toda a velocidade", "codigo"],
  },
  {
    id: "g5",
    title: "A caminho / On my way",
    url: "https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif",
    previewUrl: "https://media.giphy.com/media/l41lFw057lAJQMwg0/200w.gif",
    category: "Logística",
    tags: ["a caminho", "transporte", "carro", "rapido", "recolha", "viagem"],
  },
  {
    id: "g6",
    title: "Entrega feita / Delivery",
    url: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif",
    previewUrl: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/200w.gif",
    category: "Logística",
    tags: ["entrega", "caixa", "encomenda", "pacote", "recolhido", "feito"],
  },
  {
    id: "g7",
    title: "Ok / Combinado / Thumbs Up",
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
    previewUrl: "https://media.giphy.com/media/111ebonMs90YLu/200w.gif",
    category: "Reações",
    tags: ["ok", "fixe", "thumbs up", "positivo", "entendido", "sim"],
  },
  {
    id: "g8",
    title: "Café necessário / Coffee",
    url: "https://media.giphy.com/media/hPTZgtzfRIB5Nfb5rL/giphy.gif",
    previewUrl: "https://media.giphy.com/media/hPTZgtzfRIB5Nfb5rL/200w.gif",
    category: "Trabalho",
    tags: ["cafe", "coffee", "manha", "sono", "pausa", "energia"],
  },
  {
    id: "g9",
    title: "Dança da vitória / Dance",
    url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
    previewUrl: "https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif",
    category: "Celebração",
    tags: ["danca", "alegria", "feliz", "sucesso", "sexta"],
  },
  {
    id: "g10",
    title: "Mind blown / Incrível",
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
    previewUrl: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif",
    category: "Reações",
    tags: ["uau", "incrivel", "mind blown", "chocado", "top"],
  },
  {
    id: "g11",
    title: "Obrigado / Thank you",
    url: "https://media.giphy.com/media/osjgQPWRx3cac/giphy.gif",
    previewUrl: "https://media.giphy.com/media/osjgQPWRx3cac/200w.gif",
    category: "Reações",
    tags: ["obrigado", "agradecido", "thank you", "valeu", "abraco"],
  },
  {
    id: "g12",
    title: "A rir / Laughing",
    url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif",
    previewUrl: "https://media.giphy.com/media/10JhviFuU2gWD6/200w.gif",
    category: "Reações",
    tags: ["riso", "rir", "piada", "graca", "lol"],
  },
]

export function parseGifMessage(body: string): { isGif: boolean; gifUrl?: string; text?: string } {
  const trimmed = body.trim()
  // Pattern 1: [gif:URL]
  const tagMatch = trimmed.match(/^\[gif:(https?:\/\/[^\s\]]+)\](?:\s*([\s\S]*))?$/i)
  if (tagMatch) {
    return { isGif: true, gifUrl: tagMatch[1], text: tagMatch[2]?.trim() || undefined }
  }

  // Pattern 2: direct url ending with .gif or from known gif hosts (giphy, tenor)
  const isDirectGif = /^(https?:\/\/[^\s]+(?:\.gif|\/giphy\.gif|media\.tenor\.com[^\s]+))$/i.test(trimmed)
  if (isDirectGif) {
    return { isGif: true, gifUrl: trimmed }
  }

  return { isGif: false }
}

export function isOnlyEmojis(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 20) return false
  // Matches 1 to 5 emojis with optional whitespace
  const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\s)+$/u
  return emojiRegex.test(trimmed) && trimmed.replace(/\s+/g, "").length <= 8
}
