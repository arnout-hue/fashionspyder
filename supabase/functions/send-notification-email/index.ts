import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientEmail: string;
  subject: string;
  competitorName: string;
  newProductsCount: number;
  products?: {
    name: string;
    price?: string;
    image_url?: string;
    product_url: string;
  }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, subject, competitorName, newProductsCount, products = [] }: NotificationRequest = await req.json();

    if (!recipientEmail || !competitorName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate product preview HTML (show max 5)
    const previewProducts = products.slice(0, 5);
    const productPreviewHtml = previewProducts.map(p => `
      <div style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #eee;">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 12px;">` : '<div style="width: 50px; height: 50px; background: #f3f4f6; border-radius: 4px; margin-right: 12px;"></div>'}
        <div>
          <strong style="display: block;">${p.name}</strong>
          ${p.price ? `<span style="color: #666; font-size: 14px;">${p.price}</span>` : ''}
        </div>
      </div>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Products Alert</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #1a1a1a; margin-top: 0;">🆕 New Products Found!</h1>
          
          <p style="font-size: 16px; color: #4b5563;">
            We found <strong style="color: #2563eb;">${newProductsCount} new products</strong> from <strong>${competitorName}</strong>.
          </p>
          
          ${productPreviewHtml ? `
            <div style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
              <div style="background: #f9fafb; padding: 12px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
                Preview
              </div>
              ${productPreviewHtml}
              ${products.length > 5 ? `<div style="padding: 12px; text-align: center; color: #6b7280; font-size: 14px;">+ ${products.length - 5} more products</div>` : ''}
            </div>
          ` : ''}
          
          <p style="margin-top: 24px;">
            <a href="#" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View in FashionSpyder</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0;">
            This notification was sent by FashionSpyder. You can manage your notification preferences in settings.
          </p>
        </div>
      </body>
      </html>
    `;

    console.log(`Sending notification to ${recipientEmail} - ${newProductsCount} new products from ${competitorName}`);

    const emailResponse = await resend.emails.send({
      from: "FashionSpyder <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: subject || `${newProductsCount} new products from ${competitorName}`,
      html: emailHtml,
    });

    console.log("Notification sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});