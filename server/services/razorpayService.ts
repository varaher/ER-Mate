import crypto from "crypto";

const BASE_URL = "https://api.razorpay.com/v1";

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export interface PaymentLinkOptions {
  amountPaise: number;
  description: string;
  customerEmail?: string;
  customerName?: string;
  referenceId: string;
  callbackUrl: string;
  notes: Record<string, string>;
}

export async function createPaymentLink(opts: PaymentLinkOptions): Promise<{ url: string; id: string }> {
  const body: Record<string, unknown> = {
    amount: opts.amountPaise,
    currency: "INR",
    description: opts.description,
    notify: { email: !!opts.customerEmail, sms: false },
    callback_url: opts.callbackUrl,
    callback_method: "get",
    expire_by: Math.floor(Date.now() / 1000) + 7200,
    reference_id: opts.referenceId,
    notes: opts.notes,
  };

  if (opts.customerEmail || opts.customerName) {
    body.customer = {
      ...(opts.customerName ? { name: opts.customerName } : {}),
      ...(opts.customerEmail ? { email: opts.customerEmail } : {}),
    };
  }

  const res = await fetch(`${BASE_URL}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;
  if (!res.ok) {
    const msg = data?.error?.description || data?.error?.code || JSON.stringify(data);
    throw new Error(`Razorpay payment link error: ${msg}`);
  }

  return { url: data.short_url as string, id: data.id as string };
}

export async function createOrder(opts: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<{ orderId: string; keyId: string }> {
  const body = {
    amount: opts.amountPaise,
    currency: "INR",
    receipt: opts.receipt,
    notes: opts.notes,
  };

  const res = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;
  if (!res.ok) {
    const msg = data?.error?.description || JSON.stringify(data);
    throw new Error(`Razorpay order error: ${msg}`);
  }

  return { orderId: data.id as string, keyId: process.env.RAZORPAY_KEY_ID || "" };
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
