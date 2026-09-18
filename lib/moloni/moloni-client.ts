export class MoloniClient {
  private companyId: string;
  private developerId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  
  // This could be fetched from DB or ENV, for now ENV
  private refreshTokenVal: string;

  constructor() {
    this.companyId = process.env.MOLONI_COMPANY_ID || "";
    this.developerId = process.env.MOLONI_DEVELOPER_ID || "";
    this.clientId = process.env.MOLONI_CLIENT_ID || "";
    this.clientSecret = process.env.MOLONI_CLIENT_SECRET || "";
    this.refreshTokenVal = process.env.MOLONI_REFRESH_TOKEN || "";
  }

  /**
   * Obtém um token de acesso fresco (OAuth2 / Refresh Token)
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.developerId || !this.clientId || !this.clientSecret) {
      throw new Error("Missing Moloni credentials in environment variables.");
    }

    const url = "https://api.moloni.pt/v1/grant/?grant_type=refresh_token";
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshTokenVal
    });

    const res = await fetch(`${url}&${params.toString()}`);
    const data = await res.json();

    if (data.error) {
      throw new Error(`Moloni Auth Error: ${data.error_description || data.error}`);
    }

    this.accessToken = data.access_token;
    this.refreshTokenVal = data.refresh_token; // Should save this securely if it changes!
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

    return this.accessToken!;
  }

  /**
   * Realiza um pedido genérico à API do Moloni
   */
  private async request(endpoint: string, payload: any = {}): Promise<any> {
    const token = await this.getAccessToken();
    const res = await fetch(`https://api.moloni.pt/v1/${endpoint}/?access_token=${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        company_id: this.companyId,
        ...payload
      })
    });

    const data = await res.json();
    if (data.error) {
      throw new Error(`Moloni API Error [${endpoint}]: ${data.error_description || data.error}`);
    }
    return data;
  }

  /**
   * Verifica se o cliente existe pelo NIF
   */
  async getCustomerByVat(vat: string) {
    try {
      const customers = await this.request("customers/getByVat", { vat });
      if (Array.isArray(customers) && customers.length > 0) {
        return customers[0];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Cria um cliente no Moloni
   */
  async createCustomer(customerData: {
    vat: string;
    number: string;
    name: string;
    address: string;
    zipCode: string;
    city: string;
    country_id?: number;
    email?: string;
    phone?: string;
  }) {
    // country_id 1 is PT
    const payload = {
      vat: customerData.vat || "999999990",
      number: customerData.number,
      name: customerData.name,
      language_id: 1,
      address: customerData.address || "Desconhecida",
      zip_code: customerData.zipCode || "1000-001",
      city: customerData.city || "Desconhecida",
      country_id: customerData.country_id || 1,
      email: customerData.email || "",
      phone: customerData.phone || "",
      maturity_date_id: 0,
      payment_method_id: 0,
    };
    
    const result = await this.request("customers/insert", payload);
    return result.customer_id;
  }

  /**
   * Cria uma Fatura-Recibo (Document Type ID: 43 - Fatura-Recibo ou similar, consultar ID da API)
   * ID típicos do Moloni: 
   * 1 = Fatura
   * 2 = Fatura-Recibo
   * 3 = Fatura Simplificada
   */
  async createInvoice(data: {
    customerId: number;
    date: string;
    expirationDate: string;
    documentSetId: number; // Série documental
    products: Array<{
      productId?: number;
      name: string;
      summary?: string;
      qty: number;
      price: number;
      exemptionReason?: string; // e.g. "M01" se isento
      taxes?: Array<{ tax_id: number; value: number }>;
    }>;
  }) {
    const payload: any = {
      date: data.date,
      expiration_date: data.expirationDate,
      document_set_id: data.documentSetId,
      customer_id: data.customerId,
      status: 1, // 0 = Rascunho, 1 = Fechado
    };

    data.products.forEach((p, index) => {
      payload[`products[${index}][name]`] = p.name;
      payload[`products[${index}][summary]`] = p.summary || "";
      payload[`products[${index}][qty]`] = p.qty;
      payload[`products[${index}][price]`] = p.price;
      
      if (p.exemptionReason) {
        payload[`products[${index}][exemption_reason]`] = p.exemptionReason;
      }
      
      if (p.taxes && p.taxes.length > 0) {
        p.taxes.forEach((t, tIdx) => {
          payload[`products[${index}][taxes][${tIdx}][tax_id]`] = t.tax_id;
          payload[`products[${index}][taxes][${tIdx}][value]`] = t.value;
        });
      }
    });

    const result = await this.request("invoiceReceipts/insert", payload);
    return result; // Retorna o document_id gerado
  }

  /**
   * Obtém o link PDF de um documento
   */
  async getDocumentPDFLink(documentId: number) {
    const result = await this.request("documents/getPDFLink", { document_id: documentId });
    return result.url;
  }
}
