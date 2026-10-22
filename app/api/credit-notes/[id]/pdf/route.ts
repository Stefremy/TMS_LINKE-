import { loadFinancialDocument, financialPdfResponse } from '@/lib/services/billing/document-access'
import { creditMoloni } from '@/lib/billing/credit-notes/service'
export const dynamic='force-dynamic'
function trusted(url:string) {
  const u=new URL(url)
  const host=u.hostname.toLowerCase()
  const isAllowed=host==='moloni.pt'||host.endsWith('.moloni.pt')||host==='moloni.com'||host.endsWith('.moloni.com')||host.endsWith('.amazonaws.com')||host.endsWith('.cloudfront.net')
  if (u.protocol!=='https:' || u.username || u.password || !isAllowed) throw new Error('Endereço PDF inválido.')
  return u
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params,access=await loadFinancialDocument(id,'credit_note')
    if (!access) return financialPdfResponse('Documento não encontrado.',{status:404})
    const note=access.document.details
    if (!note.document_id) return financialPdfResponse('Documento não disponível.',{status:404})
    if (note.state!=='issued' && access.ctx.role==='client') return financialPdfResponse('Documento não disponível.',{status:404})
    const {moloni}=await creditMoloni(access.supabase,access.ctx.tenant_id,String(note.company_id))
    let link: string | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        link = await moloni.getDocumentPDFLink(Number(note.document_id))
        if (link) break
      } catch (e) {
        console.warn('Waiting for Moloni PDF generation...', e)
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    if (!link) return financialPdfResponse('PDF ainda a ser processado pelo Moloni. Aguarde alguns segundos e tente novamente.',{status:502})
    let url=trusted(link),response:Response|undefined
    for(let count=0;count<5;count++) {
      response=await fetch(url,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)})
      if (![301,302,303,307,308].includes(response.status)) break
      const location=response.headers.get('location')
      if(!location) throw new Error('PDF inválido')
      url=trusted(new URL(location,url).href)
    }
    if (!response?.ok) throw new Error('PDF indisponível')
    if (Number(response.headers.get('content-length'))>20_000_000) throw new Error('PDF demasiado grande')
    const buffer=await response.arrayBuffer()
    if(buffer.byteLength>20_000_000 || new TextDecoder().decode(buffer.slice(0,4))!=='%PDF') throw new Error('PDF inválido')
    const cleanNumber = String(note.number || id).replace(/[\/\\]/g, '_')
    return financialPdfResponse(buffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="Nota_Credito_${cleanNumber}.pdf"`}})
  } catch(err) {
    console.error('Credit note PDF download error:', err)
    return financialPdfResponse('Não foi possível obter o PDF. Tente novamente mais tarde.',{status:502})
  }
}

