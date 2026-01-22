import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape function to prevent XSS attacks
function escapeHtml(text: string): string {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m] || m));
}

// Validate and sanitize URL
function sanitizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return escapeHtml(url);
  } catch {
    return '';
  }
}

interface Product {
  id: string;
  name: string;
  price?: string;
  image_url?: string;
  product_url: string;
  competitor: string;
  notes?: string;
}

interface EmailRequest {
  recipientEmail: string;
  recipientName: string;
  collectionName: string;
  products: Product[];
  customMessage?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await authSupabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      recipientEmail, 
      recipientName, 
      collectionName,
      products, 
      customMessage,
    }: EmailRequest = await req.json();

    if (!recipientEmail || !recipientName || !products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Escape all user-provided content
    const safeRecipientName = escapeHtml(recipientName);
    const safeCollectionName = escapeHtml(collectionName);
    const safeCustomMessage = customMessage ? escapeHtml(customMessage) : null;

    // Generate product HTML with escaped content
    const productCards = products.map(p => {
      const safeName = escapeHtml(p.name);
      const safeCompetitor = escapeHtml(p.competitor);
      const safePrice = p.price ? escapeHtml(p.price) : '';
      const safeProductUrl = sanitizeUrl(p.product_url);
      const safeImageUrl = sanitizeUrl(p.image_url || '');
      
      return `
      <div style="display: inline-block; width: 200px; margin: 8px; vertical-align: top; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        ${safeImageUrl 
          ? `<img src="${safeImageUrl}" alt="${safeName}" style="width: 100%; height: 200px; object-fit: cover;">`
          : `<div style="width: 100%; height: 200px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af;">No image</div>`
        }
        <div style="padding: 12px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; line-height: 1.3; max-height: 36px; overflow: hidden;">${safeName}</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">${safeCompetitor}</p>
          ${safePrice ? `<p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827;">${safePrice}</p>` : ''}
          ${safeProductUrl ? `<a href="${safeProductUrl}" style="display: inline-block; padding: 6px 12px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; font-size: 12px;">View Product</a>` : ''}
        </div>
      </div>
    `;
    }).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeCollectionName}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a1a1a; margin: 0 0 8px 0;">📁 ${safeCollectionName}</h1>
          <p style="color: #6b7280; margin: 0;">${products.length} products</p>
        </div>
        
        <p style="font-size: 16px; color: #374151;">Hi ${safeRecipientName},</p>
        
        ${safeCustomMessage 
          ? `<p style="font-size: 16px; color: #374151; margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #2563eb;">${safeCustomMessage}</p>` 
          : `<p style="font-size: 16px; color: #374151;">Here's a curated collection of products for you to review:</p>`
        }
        
        <div style="margin: 32px 0; text-align: center;">
          ${productCards}
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          This collection was shared via FashionSpyder
        </p>
      </body>
      </html>
    `;

    console.log(`Sending collection email with ${products.length} products to ${recipientEmail}`);

    const emailResponse = await resend.emails.send({
      from: "FashionSpyder <spidey@fashionspyder.nl>",
      to: [recipientEmail],
      subject: `${safeCollectionName} - ${products.length} products shared with you`,
      html: emailHtml,
    });

    console.log("Collection email sent successfully");

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error sending collection email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
