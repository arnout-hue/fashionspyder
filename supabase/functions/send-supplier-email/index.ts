import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface EmailRequest {
  supplierId: string;
  supplierEmail: string;
  supplierName: string;
  products: Product[];
  senderName?: string;
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
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { supplierId, supplierEmail, supplierName, products, senderName = "FashionSpyder", customMessage }: EmailRequest = await req.json();

    if (!supplierEmail || !products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate product HTML
    const productRows = products.map(p => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <strong>${p.name}</strong><br>
          <span style="color: #666; font-size: 12px;">${p.competitor}</span>
          ${p.price ? `<br><span style="color: #333;">${p.price}</span>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <a href="${p.product_url}" style="color: #2563eb;">View Product</a>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 12px; color: #666;">
          ${p.notes || '-'}
        </td>
      </tr>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Product Inquiry</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a;">Product Inquiry</h1>
        
        <p>Dear ${supplierName},</p>
        
        ${customMessage ? `<p>${customMessage}</p>` : `<p>We are interested in sourcing the following products and would like to inquire about availability and pricing:</p>`}
        
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Image</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Reference</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>
        
        <p>Total items: <strong>${products.length}</strong></p>
        
        <p>Please let us know about:</p>
        <ul>
          <li>Availability and lead times</li>
          <li>MOQ (Minimum Order Quantity)</li>
          <li>Pricing per unit</li>
          <li>Customization options (if any)</li>
        </ul>
        
        <p>Looking forward to your response.</p>
        
        <p>Best regards,<br>${senderName}</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="font-size: 12px; color: #6b7280;">This email was sent via FashionSpyder product sourcing platform.</p>
      </body>
      </html>
    `;

    console.log(`Sending email to ${supplierEmail} with ${products.length} products`);

    const emailResponse = await resend.emails.send({
      from: "FashionSpyder <onboarding@resend.dev>",
      to: [supplierEmail],
      subject: `Product Inquiry - ${products.length} items`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Mark products as sent in database
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const productIds = products.map(p => p.id);
    await supabase
      .from('products')
      .update({ is_sent: true, status: 'requested' })
      .in('id', productIds);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});