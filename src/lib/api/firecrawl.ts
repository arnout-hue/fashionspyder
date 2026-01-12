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

  // Scrape all products from a competitor
  async scrapeCompetitor(competitor: string, limit?: number): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('scrape-competitor-products', {
      body: { competitor, limit },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },
};

// Competitor configuration for the UI
export const COMPETITORS = [
  { name: 'Loavies', baseUrl: 'https://loavies.com/nl' },
  { name: 'My Jewellery', baseUrl: 'https://www.my-jewellery.com/nl' },
  { name: 'Tess V', baseUrl: 'https://www.tessv.nl' },
  { name: 'Most Wanted', baseUrl: 'https://www.mostwanted.nl' },
  { name: 'Olivia Kate', baseUrl: 'https://oliviakate.nl' },
] as const;
