import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
};

type ScrapeOptions = {
  formats?: (
    | 'markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot' | 'branding' | 'summary'
    | { type: 'json'; schema?: object; prompt?: string }
  )[];
  onlyMainContent?: boolean;
  waitFor?: number;
  location?: { country?: string; languages?: string[] };
};

type MapOptions = {
  search?: string;
  limit?: number;
  includeSubdomains?: boolean;
};

interface Product {
  id: string;
  name: string;
  price?: string;
  image_url?: string;
  product_url: string;
  competitor: string;
  notes?: string;
}

export const firecrawlApi = {
  // Scrape a single URL
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Map a website to discover all URLs (fast sitemap)
  async map(url: string, options?: MapOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-map', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Scrape all products from a competitor (by ID or name)
  async scrapeCompetitor(competitorId: string, limit?: number): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('scrape-competitor-products', {
      body: { competitor: competitorId, limit },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },
};

export const emailApi = {
  // Send supplier request email
  async sendSupplierEmail(
    supplierId: string,
    supplierEmail: string,
    supplierName: string,
    products: Product[],
    senderName?: string,
    customMessage?: string
  ): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('send-supplier-email', {
      body: { supplierId, supplierEmail, supplierName, products, senderName, customMessage },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Send colleague email with product selection
  async sendColleagueEmail(
    colleagueId: string,
    colleagueEmail: string,
    colleagueName: string,
    products: Product[],
    senderName?: string,
    customMessage?: string,
    subject?: string
  ): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('send-colleague-email', {
      body: { colleagueId, colleagueEmail, colleagueName, products, senderName, customMessage, subject },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Send notification email
  async sendNotification(
    recipientEmail: string,
    competitorName: string,
    newProductsCount: number,
    products?: Partial<Product>[]
  ): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: { 
        recipientEmail, 
        subject: `${newProductsCount} new products from ${competitorName}`,
        competitorName, 
        newProductsCount, 
        products 
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },
};
