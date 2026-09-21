export class MoloniClient {
  private companyId: string;
  private developerId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  
  // This could be fetched from DB or ENV, for now ENV
  private refreshTokenVal: string;

  constructor(config?: { companyId?: string; refreshToken?: string }) {
    this.companyId = config?.companyId || process.env.MOLONI_COMPANY_ID || "";
    this.developerId = process.env.MOLONI_DEVELOPER_ID || process.env.MOLONI_CLIENT_ID || "518600300";
    this.clientId = process.env.MOLONI_CLIENT_ID || "518600300";
    this.clientSecret = process.env.MOLONI_CLIENT_SECRET || "0b78b0aef4abfc92960a0c9d97dbe9b7abd8b325";
    this.refreshTokenVal = config?.refreshToken || process.env.MOLONI_REFRESH_TOKEN || "";
  }

  /**
   * Autenticação via utilizador e password da conta Moloni (grant_type=password)
   */
  static async loginWithPassword(username: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    companies: Array<{ company_id: number; name: string; vat: string }>;
  }> {
    const clientId = process.env.MOLONI_CLIENT_ID || "518600300";
    const clientSecret = process.env.MOLONI_CLIENT_SECRET || "0b78b0aef4abfc92960a0c9d97dbe9b7abd8b325";
    
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password,
    });
    
    const res = await fetch(`https://api.moloni.pt/v1/grant/?grant_type=password&${params.toString()}`);
    const data = await res.json();
    
    if (data.error) {
      throw new Error(`Erro Moloni: ${data.error_description || data.error}`);
    }
    
    const compRes = await fetch(`https://api.moloni.pt/v1/companies/getAll/?access_token=${data.access_token}`);
    const companies = await compRes.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      companies: Array.isArray(companies) ? companies : [],
    };
  }

  /**
   * Troca de código de autorização OAuth por tokens (grant_type=authorization_code)
   */
  static async exchangeAuthCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    companies: Array<{ company_id: number; name: string; vat: string }>;
  }> {
    const clientId = process.env.MOLONI_CLIENT_ID || "518600300";
    const clientSecret = process.env.MOLONI_CLIENT_SECRET || "0b78b0aef4abfc92960a0c9d97dbe9b7abd8b325";
    
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    
    const res = await fetch(`https://api.moloni.pt/v1/grant/?grant_type=authorization_code&${params.toString()}`);
    const data = await res.json();
    
    if (data.error) {
      throw new Error(`Erro Moloni OAuth: ${data.error_description || data.error}`);
    }
    
    const compRes = await fetch(`https://api.moloni.pt/v1/companies/getAll/?access_token=${data.access_token}`);
    const companies = await compRes.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      companies: Array.isArray(companies) ? companies : [],
    };
  }

  /**
   * Obtém um token de acesso fresco (OAuth2 / Refresh Token)
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error("Credenciais do Moloni (Client ID / Client Secret) não configuradas.");
    }

    if (!this.refreshTokenVal) {
      throw new Error("Conta Moloni ainda não conectada (falta Refresh Token). Use a opção 'Ligar Moloni' para autorizar.");
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
    this.refreshTokenVal = data.refresh_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;

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

    const json = await res.json();
    
    // Check for different error structures in Moloni API
    if (Array.isArray(json)) {
      if (json[0]?.error) {
        throw new Error(`Moloni API Error at ${endpoint}: ${json[0].error_description || json[0].error}`);
      }
      if (json[0]?.msg) {
        const errorMsg = json.map((e: any) => `${e.field || ''}: ${e.msg || e.description || JSON.stringify(e)}`).join(', ');
        throw new Error(`Moloni API Error at ${endpoint}: ${errorMsg}`);
      }
    }

    if (json && json.valid === 0) {
      const errorMsg = json.error_description || json.error || json.description || JSON.stringify(json);
      throw new Error(`Moloni API Error at ${endpoint}: ${errorMsg}`);
    }

    if (json && json.error) {
      throw new Error(`Moloni API Error at ${endpoint}: ${json.error_description || json.error}`);
    }

    return json;
  }

  // --- Helpers extraídos do Linke-store ---

  async getDocumentSet() {
    const sets = await this.request('documentSets/getAll', {});
    const activeSet = sets.find((s: any) => s.active === 1);
    return activeSet ? activeSet.document_set_id : sets[0]?.document_set_id;
  }

  async getTaxId(taxRate: number) {
    const taxes = await this.request('taxes/getAll', {});
    const tax = taxes.find((t: any) => Math.round(parseFloat(t.value)) === taxRate);
    return tax ? tax.tax_id : taxes[0]?.tax_id;
  }

  async getMaturityDateId() {
    const dates = await this.request('maturityDates/getAll', {});
    return dates[0]?.maturity_date_id || 0;
  }

  async getPaymentMethodId() {
    const methods = await this.request('paymentMethods/getAll', {});
    return methods[0]?.payment_method_id || 0;
  }

  async getGenericProductId(taxId: number): Promise<number> {
    const products = await this.request('products/getAll', { qty: 50, offset: 0 });
    if (Array.isArray(products)) {
      const existing = products.find((p: any) => p.reference === 'LINKE-TMS');
      if (existing) return existing.product_id;
    }
    // Create the generic product
    const measureUnits = await this.request('measurementUnits/getAll', {});
    const unitId = Array.isArray(measureUnits) ? measureUnits[0]?.unit_id : 0;
    
    const categories = await this.request('productCategories/getAll', {});
    const categoryId = Array.isArray(categories) ? categories[0]?.category_id : 0;
    
    const result = await this.request('products/insert', {
      name: 'Serviços de Logística e Transporte',
      summary: 'Produto genérico para faturas do TMS',
      reference: 'LINKE-TMS',
      price: 1,
      unit_id: unitId,
      category_id: categoryId,
      type: 1, // Serviço
      has_stock: 0,
      exemption_reason: '',
      taxes: [{ tax_id: taxId, value: 23, order: 1, cumulative: 0 }]
    });
    
    if (!result?.product_id) throw new Error('Não foi possível criar produto genérico no Moloni.');
    return result.product_id;
  }

  // --- Entidades Principais ---

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
    number?: string;
    name: string;
    address: string;
    zipCode: string;
    city: string;
    country_id?: number;
    email?: string;
    phone?: string;
  }) {
    const maturityDateId = await this.getMaturityDateId();
    const paymentMethodId = await this.getPaymentMethodId();

    const payload = {
      vat: customerData.vat || "999999990",
      number: customerData.number || `C${Date.now()}`,
      name: customerData.name || "Consumidor Final",
      language_id: 1,
      address: customerData.address || "Desconhecida",
      zip_code: customerData.zipCode || "1000-001",
      city: customerData.city || "Desconhecida",
      country_id: customerData.country_id || 1, // 1 is PT
      email: customerData.email || "",
      phone: customerData.phone || "",
      maturity_date_id: maturityDateId,
      payment_method_id: paymentMethodId,
      salesman_id: 0,
      payment_day: 0,
      discount: 0,
      credit_limit: 0,
      delivery_method_id: 0,
    };
    
    const result = await this.request("customers/insert", payload);
    return result.customer_id;
  }

  /**
   * Cria uma Fatura (ou documento equivalente)
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
      price: number; // Price sem IVA
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
      payload[`products[${index}][product_id]`] = p.productId || 0;
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

    const result = await this.request("invoices/insert", payload);
    return result;
  }

  /**
   * Obtém o link PDF de um documento
   */
  async getDocumentPDFLink(documentId: number) {
    const result = await this.request("documents/getPDFLink", { document_id: documentId });
    return result.url;
  }
}
