import { getDb } from "../db";
import { subscriptions } from "../../shared/schema";
import { eq } from "drizzle-orm";

const FREE_CASE_LIMIT = 10;
const PREMIUM_CASE_LIMIT = 999999;
const TRIAL_CASE_LIMIT = 999999;
const TRIAL_AI_CREDITS = 999;
const PREMIUM_PRICE_INR = 559;
const BASE_AI_CREDITS = 20;
const PRO_AI_CREDITS = 50;

function isTrialActive(sub: { plan: string; currentPeriodEnd: Date | null }): boolean {
  if (sub.plan !== "trial") return false;
  if (!sub.currentPeriodEnd) return false;
  return new Date() < new Date(sub.currentPeriodEnd);
}

export async function getOrCreateSubscription(userId: string, userEmail: string) {
  const db = getDb()!;
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

  if (existing.length > 0) {
    const sub = existing[0];
    // Auto-expire trial: if plan is "trial" and period ended, downgrade to free
    if (sub.plan === "trial" && sub.currentPeriodEnd && new Date() >= new Date(sub.currentPeriodEnd)) {
      await db.update(subscriptions)
        .set({ plan: "free", casesLimit: FREE_CASE_LIMIT, casesUsed: 0, aiCredits: 5, updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
      return { ...sub, plan: "free", casesLimit: FREE_CASE_LIMIT, casesUsed: 0, aiCredits: 5 };
    }
    return sub;
  }

  // New user → 30-day free trial with all features
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 30);

  const [newSub] = await (db as any).insert(subscriptions).values({
    userId,
    userEmail,
    plan: "trial",
    status: "active",
    casesUsed: 0,
    casesLimit: TRIAL_CASE_LIMIT,
    aiCredits: TRIAL_AI_CREDITS,
    currentPeriodStart: now,
    currentPeriodEnd: trialEnd,
  }).returning();

  return newSub;
}

export async function canCreateCase(userId: string, userEmail: string): Promise<{ allowed: boolean; casesUsed: number; casesLimit: number; plan: string }> {
  const sub = await getOrCreateSubscription(userId, userEmail);

  // Paid plans and active trials: unlimited
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
  // Paid plans and active trials: unlimited, never deduct
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
