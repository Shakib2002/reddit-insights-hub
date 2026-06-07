import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LemonSqueezy Webhook Handler
 *
 * Receives subscription events from LemonSqueezy and updates
 * the user's subscription_tier in the profiles table.
 *
 * Set these secrets in Supabase:
 * - LEMONSQUEEZY_WEBHOOK_SECRET: Your LemonSqueezy webhook signing secret
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for admin writes)
 */

const TIER_MAP: Record<string, string> = {
  // TODO: Map your LemonSqueezy variant IDs to plan tiers
  // "variant-id-founder": "founder",
  // "variant-id-pro": "pro",
  // "variant-id-agency": "agency",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const signature = req.headers.get("x-signature");
    const webhookSecret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");

    // Verify webhook signature
    if (webhookSecret && signature) {
      const body = await req.clone().text();
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
      const hexSig = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (hexSig !== signature) {
        console.error("Webhook signature mismatch");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    const eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data;
    const userId = customData?.user_id;

    if (!userId) {
      console.warn("No user_id in custom_data, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let tier = "free";

    if (
      eventName === "subscription_created" ||
      eventName === "subscription_updated" ||
      eventName === "subscription_resumed"
    ) {
      const variantId = String(payload.data?.attributes?.variant_id ?? "");
      tier = TIER_MAP[variantId] ?? "founder"; // Default to founder if variant not mapped
      const status = payload.data?.attributes?.status;

      // Only activate if status is "active" or "on_trial"
      if (status !== "active" && status !== "on_trial") {
        tier = "free";
      }
    } else if (
      eventName === "subscription_cancelled" ||
      eventName === "subscription_expired" ||
      eventName === "subscription_paused"
    ) {
      tier = "free";
    } else {
      // Unknown event, just acknowledge
      return new Response(JSON.stringify({ ok: true, event: eventName }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update user's subscription tier
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          subscription_tier: tier,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) {
      console.error("Failed to update subscription:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Updated user ${userId} to tier: ${tier} (event: ${eventName})`);
    return new Response(
      JSON.stringify({ ok: true, userId, tier, event: eventName }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
