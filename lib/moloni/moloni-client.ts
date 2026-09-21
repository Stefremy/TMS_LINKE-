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

    // Immediately persist rotated refresh token
    if (data.refresh_token) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const envPath = path.join(process.cwd(), ".env.local");
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, "utf8");
          if (envContent.includes("MOLONI_REFRESH_TOKEN=")) {
            envContent = envContent.replace(/MOLONI_REFRESH_TOKEN=.*(\r?\n|$)/, `MOLONI_REFRESH_TOKEN=${data.refresh_token}\n`);
          } else {
            envContent += `\nMOLONI_REFRESH_TOKEN=${data.refresh_token}\n`;
          }
          fs.writeFileSync(envPath, envContent, "utf8");
        }
      } catch (e) {
        console.warn("Could not save updated refresh token to .env.local:", e);
      }
    }

    return this.accessToken!;
  }

  /**
   * Realiza um pedido genérico à API do Moloni usando JSON
   */
  private async request(endpoint: string, payload: any = {}): Promise<any> {
    const token = await this.getAccessToken();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const finalEndpoint = cleanEndpoint.endsWith('/') ? cleanEndpoint : `${cleanEndpoint}/`;

    const params = new URLSearchParams();
    params.append('access_token', token);
    params.append('json', 'true');
    params.append('human_errors', 'true');

    const bodyData = {
      company_id: Number(this.companyId),
      ...payload
    };

    const res = await fetch(`https://api.moloni.pt/v1/${finalEndpoint}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bodyData),
      cache: "no-store"
    });

    const json = await res.json();
    
    // Check for error structures in Moloni API
    if (Array.isArray(json)) {
      if (json[0]?.error) {
        throw new Error(`Moloni API Error [${endpoint}]: ${json[0].error_description || json[0].error}`);
      }
      if (json[0]?.msg) {
        const errorMsg = json.map((e: any) => `${e.field || ''}: ${e.msg || e.description || JSON.stringify(e)}`).join(', ');
        throw new Error(`Moloni API Error [${endpoint}]: ${errorMsg}`);
      }
    }

    if (json && json.valid === 0) {
      const errorMsg = json.error_description || json.error || json.description || JSON.stringify(json);
      throw new Error(`Moloni API Error [${endpoint}]: ${errorMsg}`);
    }

    if (json && json.error) {
      throw new Error(`Moloni API Error [${endpoint}]: ${json.error_description || json.error}`);
    }

    return json;
  }

  // --- Helpers extraídos do Linke-store ---

  async getDocumentSet() {
    const sets = await this.request('documentSets/getAll', {});
    if (!Array.isArray(sets) || sets.length === 0) {
      throw new Error("Nenhuma série documental encontrada na empresa Moloni.");
    }
    const activeSet = sets.find((s: any) => s.active === 1);
    return activeSet ? activeSet.document_set_id : sets[0]?.document_set_id;
  }

  async getTaxId(taxRate: number) {
    const taxes = await this.request('taxes/getAll', {});
    if (Array.isArray(taxes)) {
      const tax = taxes.find((t: any) => Math.round(parseFloat(t.value)) === taxRate);
      if (tax) return tax.tax_id;
      if (taxes[0]?.tax_id) return taxes[0].tax_id;
    }
    return 0;
  }

  async getMaturityDateId() {
    const dates = await this.request('maturityDates/getAll', {});
    return Array.isArray(dates) && dates[0]?.maturity_date_id ? dates[0].maturity_date_id : 0;
  }

  async getPaymentMethodId() {
    const methods = await this.request('paymentMethods/getAll', {});
    return Array.isArray(methods) && methods[0]?.payment_method_id ? methods[0].payment_method_id : 0;
  }

  async getGenericProductId(taxId: number): Promise<number> {
    const products = await this.request('products/getAll', { qty: 50, offset: 0 });
    if (Array.isArray(products) && products.length > 0) {
      const existing = products.find((p: any) => p.reference === 'LINKE-TMS' || p.reference === 'LINKE-ONLINE');
      if (existing) return existing.product_id;
      // If any service or general product exists, reuse it
      const anyService = products.find((p: any) => p.type === 1 || p.name?.toLowerCase().includes('transporte') || p.name?.toLowerCase().includes('logística'));
      if (anyService) return anyService.product_id;
    }

    // Obter ou criar unidade de medida
    let unitId = 0;
    try {
      const measureUnits = await this.request('measurementUnits/getAll', {});
      unitId = Array.isArray(measureUnits) && measureUnits[0]?.unit_id ? measureUnits[0].unit_id : 0;
      if (!unitId) {
        const newUnit = await this.request('measurementUnits/insert', { name: 'Serviço', short_name: 'serv' });
        unitId = newUnit?.unit_id || 0;
      }
    } catch {}

    // Obter ou criar categoria de produto
    let categoryId = 0;
    try {
      const categories = await this.request('productCategories/getAll', {});
      categoryId = Array.isArray(categories) && categories[0]?.category_id ? categories[0].category_id : 0;
      if (!categoryId) {
        const newCat = await this.request('productCategories/insert', { name: 'Transportes', parent_id: 0 });
        categoryId = newCat?.category_id || 0;
      }
    } catch {}

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
      taxes: taxId ? [{ tax_id: taxId, value: 23, order: 1, cumulative: 0 }] : []
    });

    if (!result?.product_id) {
      throw new Error(`Não foi possível criar produto genérico no Moloni: ${JSON.stringify(result)}`);
    }
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
    const formattedProducts = data.products.map((p) => ({
      product_id: p.productId || 0,
      name: p.name,
      summary: p.summary || "",
      qty: p.qty || 1,
      price: Number(p.price || 0),
      discount: 0,
      exemption_reason: p.exemptionReason || "",
      taxes: (p.taxes || []).map((t, tIdx) => ({
        tax_id: t.tax_id,
        value: Number(t.value || 23),
        order: tIdx + 1,
        cumulative: 0,
      })),
    }));

    const payload: any = {
      date: data.date,
      expiration_date: data.expirationDate,
      document_set_id: data.documentSetId,
      customer_id: data.customerId,
      status: 1, // 1 = Fechado / Certificado AT
      products: formattedProducts,
    };

    let result;
    try {
      result = await this.request("invoices/insert", payload);
    } catch (err1: any) {
      console.warn("Could not insert status 1 invoice, falling back to status 0:", err1?.message);
      payload.status = 0;
      result = await this.request("invoices/insert", payload);
    }

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
