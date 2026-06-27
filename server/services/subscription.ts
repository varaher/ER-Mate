import { getDb } from "../db";
import { subscriptions } from "../../shared/schema";
import { eq } from "drizzle-orm";

const FREE_CASE_LIMIT = 10;
const PREMIUM_CASE_LIMIT = 999999;
const PREMIUM_PRICE_INR = 559;
const BASE_AI_CREDITS = 20;
const PRO_AI_CREDITS = 50;

export async function getOrCreateSubscription(userId: string, userEmail: string) {
  const db = getDb()!;
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [newSub] = await (db as any).insert(subscriptions).values({
    userId,
    userEmail,
    plan: "free",
    status: "active",
    casesUsed: 0,
    casesLimit: FREE_CASE_LIMIT,
    aiCredits: 5,
  }).returning();

  return newSub;
}

export async function canCreateCase(userId: string, userEmail: string): Promise<{ allowed: boolean; casesUsed: number; casesLimit: number; plan: string }> {
  const sub = await getOrCreateSubscription(userId, userEmail);

  if (sub.plan !== "free") {
    return { allowed: true, casesUsed: sub.casesUsed, casesLimit: sub.casesLimit, plan: sub.plan };
  }

  if (sub.casesUsed < sub.casesLimit) {
    return { allowed: true, casesUsed: sub.casesUsed, casesLimit: sub.casesLimit, plan: sub.plan };
  }

  return { allowed: false, casesUsed: sub.casesUsed, casesLimit: sub.casesLimit, plan: sub.plan };
}

export async function incrementCaseCount(userId: string, userEmail: string) {
  const db = getDb()!;
  const sub = await getOrCreateSubscription(userId, userEmail);

  await db.update(subscriptions)
    .set({
      casesUsed: sub.casesUsed + 1,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));

  return { casesUsed: sub.casesUsed + 1, casesLimit: sub.casesLimit };
}

/** Legacy – kept for backward compatibility */
export async function activatePremium(userId: string, stripeCustomerId?: string, stripeSubscriptionId?: string) {
  return activatePlan(userId, "base", "monthly", undefined, stripeCustomerId, stripeSubscriptionId);
}

/**
 * Activate (or upgrade) a plan after a successful Razorpay payment.
 */
export async function activatePlan(
  userId: string,
  plan: "base" | "pro",
  cycle: "monthly" | "annual",
  razorpayPaymentLinkId?: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
) {
  const db = getDb()!;
  const sub = await getOrCreateSubscription(userId, "");

  const now = new Date();
  const periodEnd = new Date(now);
  if (cycle === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  await db.update(subscriptions)
    .set({
      plan,
      status: "active",
      casesLimit: PREMIUM_CASE_LIMIT,
      aiCredits: plan === "pro" ? PRO_AI_CREDITS : BASE_AI_CREDITS,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      stripeCustomerId: stripeCustomerId || sub.stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId || sub.stripeSubscriptionId,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  // Also persist razorpay payment link id via raw SQL (column may not be in Drizzle schema yet)
  if (razorpayPaymentLinkId) {
    try {
      const { getPool } = await import("../db");
      const pool = getPool()!;
      await pool.query(
        `UPDATE subscriptions SET razorpay_payment_link_id = $1, billing_cycle = $2 WHERE id = $3`,
        [razorpayPaymentLinkId, cycle, sub.id]
      );
    } catch {
      // Column may not exist yet – non-fatal
    }
  }
}

export async function cancelSubscription(userId: string) {
  const db = getDb()!;
  const sub = await getOrCreateSubscription(userId, "");

  await db.update(subscriptions)
    .set({
      plan: "free",
      status: "cancelled",
      casesLimit: FREE_CASE_LIMIT,
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
}

export async function resetMonthlyCases(userId: string) {
  const db = getDb()!;
  const sub = await getOrCreateSubscription(userId, "");

  await db.update(subscriptions)
    .set({
      casesUsed: 0,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));
}

export async function deductAiCredit(userId: string): Promise<{ ok: boolean; remaining: number }> {
  const db = getDb()!;
  const sub = await getOrCreateSubscription(userId, "");
  // Free plan can use their 5 one-time credits; unlimited plans (pro) never deduct
  if (sub.plan !== "free") return { ok: true, remaining: 9999 };
  if (sub.aiCredits <= 0) return { ok: false, remaining: 0 };
  await db.update(subscriptions)
    .set({ aiCredits: sub.aiCredits - 1, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));
  return { ok: true, remaining: sub.aiCredits - 1 };
}

export async function addAiCredits(userId: string, amount: number) {
  const db = getDb()!;
  const sub = await getOrCreateSubscription(userId, "");
  await db.update(subscriptions)
    .set({ aiCredits: sub.aiCredits + amount, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));
  return { aiCredits: sub.aiCredits + amount };
}

export { FREE_CASE_LIMIT, PREMIUM_CASE_LIMIT, PREMIUM_PRICE_INR, BASE_AI_CREDITS, PRO_AI_CREDITS };
