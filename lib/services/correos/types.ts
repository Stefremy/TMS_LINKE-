export interface CorreosCredentials {
  environment: "test" | "production"
  solicitante: string
  codRte: string
  user: string
  pass: string
}

export interface CorreosAddress {
  nombre: string
  nif?: string
  direccion: string
  poblacion: string
  cpNacional?: string
  cpInternacional?: string
  paisISO: string
  contacto?: string
  telefono?: string
  email?: string
}

export interface CorreosShipmentInput {
  ref?: string
  refCliente?: string
  fecha?: string // DDMMYYYY
  observaciones?: string
  
  remitente: CorreosAddress
  destinatario: CorreosAddress
  
  bultos: number
  kilos: number
  volumen?: string
  
  producto: string // e.g. "63"
  portes: "P" | "D" // Pagado o Debido
  reembolso?: string
  entrSabado?: "S" | "N"
  seguro?: string
  
  listaBultos?: Array<{
    alto?: string
    ancho?: string
    largo?: string
    codBultoCli?: string
    codUnico?: string
    descripcion?: string
    kilos?: string
    volumen?: string
    observaciones?: string
    orden?: string
    referencia?: string
  }>
  
  tipoEtiqueta?: "1" | "2" | "3" | "4" | "5" // 1=PDF, 2=ZPL
}

export interface CorreosShipmentOutput {
  codigoRetorno: number
  mensajeRetorno: string
  datosResultado?: string // The tracking number / numEnvio
  envios?: Array<{
    numEnvio?: string
    ref?: string
  }>
  listaBultos?: Array<{
    orden: string
    codUnico: string
  }>
  etiqueta?: Array<{
    [key: string]: string // e.g. "etiqueta1": "base64..."
  }>
  listaInformacionAdicional?: Array<{
    tipoEtiqueta?: string
    etiquetaPDF?: string
  }>
}

export interface CorreosTrackingOutput {
  error: number
  mensajeError: string
  resultado: string
  numEnvio: string
  ref: string
  refCliente: string
  fecha: string
  codRte: string
  nomRte: string
  nifRte: string
  dirRte: string
  pobRte: string
  codPostNacRte: string
  paisISORte: string
  codPostIntRte: string
  contacRte: string
  telefRte: string
  emailRte: string
  codDest: string
  nomDestRte: string
  nifDest: string
  dirDest: string
  pobDest: string
  codPostNacDest: string
  contacDest: string
  telefDest: string
  emailDest: string
  numBultos: string
  kilos: string
  volumen: string
  producto: string
  portes: string
  reembolso: string
  entrSabado: string
  codEstado: string
  descEstado: string
  fechaEstado: string
  horaEstado: string
  codIncEstado: string
  descIncEstado: string
  
  estadoEnvios?: Array<{
    codEstado: string
    descEstado: string
    fechaEstado: string
    horaEstado: string
    codIncEstado: string
    descIncEstado: string
    idDelegacion?: string
    nombreDelegacion?: string
  }>
  
  bultoSeguimiento?: Array<{
    orden: string
    codUnico: string
    referencia: string
    codEstado: string
    descEstado: string
    fechaEstado: string
    horaEstado: string
    codIncEstado: string
    descIncEstado: string
    imgUrlPOD?: string
  }>
}
