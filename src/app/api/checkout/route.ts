import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { CAP_VARIANTS } from "@/data/caps";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, currency = "USD", locale = "en", clerkUserId, customerEmail } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Resolve authenticated Clerk user ID
    let resolvedClerkId = clerkUserId;
    try {
      const serverAuth = await auth();
      if (serverAuth?.userId) {
        resolvedClerkId = serverAuth.userId;
      }
    } catch (e) {
      // Auth resolution fallback
    }

    // Server-side validation against official catalog data
    let totalItems = 0;
    let subtotal = 0;
    const validatedItems: {
      variantId: string;
      name: string;
      quantity: number;
      price: number;
      image: string;
    }[] = [];

    for (const item of items) {
      const cap = CAP_VARIANTS.find((c) => c.id === item.id);
      if (!cap) {
        return NextResponse.json({ error: `Invalid cap variant: ${item.id}` }, { status: 400 });
      }
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitPrice = currency === "USD" ? cap.priceUsd : cap.priceMxn;
      totalItems += qty;
      subtotal += unitPrice * qty;

      validatedItems.push({
        variantId: cap.id,
        name: locale === "es" ? cap.nameEs : cap.nameEn,
        quantity: qty,
        price: unitPrice,
        image: cap.image,
      });
    }

    const freeShipping = totalItems >= 2;
    const shippingFee = freeShipping ? 0 : currency === "USD" ? 8 : 150;
    const total = subtotal + shippingFee;

    const orderNumber = `MC-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return NextResponse.json(
        {
          error: "STRIPE_SECRET_KEY is missing from .env.local. Please configure your Stripe secret key for real checkout.",
        },
        { status: 400 }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-02-24.acacia" as any,
    });

    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map((item) => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: {
          name: `Moya Caps 0880 — ${item.name}`,
          images: [item.image.startsWith("http") ? item.image : `${origin}${item.image}`],
          metadata: {
            variantId: item.variantId,
          },
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: {
            amount: Math.round(shippingFee * 100),
            currency: currency.toLowerCase(),
          },
          display_name: freeShipping ? "Free Worldwide Express Delivery" : "Express Tracked Courier",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 2 },
            maximum: { unit: "business_day", value: 4 },
          },
        },
      },
    ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "link"],
      line_items: stripeLineItems,
      mode: "payment",
      customer_email: customerEmail || undefined,
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: [
          "US", "MX", "CA", "GB", "ES", "FR", "DE", "IT", "NL", "AU", "NZ", "JP", "BR", "CO", "CL", "AR"
        ],
      },
      phone_number_collection: {
        enabled: true,
      },
      shipping_options: shippingOptions,
      success_url: `${origin}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_number=${orderNumber}`,
      cancel_url: `${origin}/${locale}?canceled=true`,
      metadata: {
        orderNumber,
        clerkUserId: resolvedClerkId || "",
        currency,
        subtotal: subtotal.toString(),
        shippingFee: shippingFee.toString(),
        total: total.toString(),
        itemsJson: JSON.stringify(validatedItems),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate secure checkout session" },
      { status: 500 }
    );
  }
}
