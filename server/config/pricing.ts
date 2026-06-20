export const STRIPE_PRICE_IDS = {
  base: {
    monthly: "price_base_monthly_XXXXXXXX",
    annual: "price_base_annual_XXXXXXXX",
  },
  pro: {
    monthly: "price_pro_monthly_XXXXXXXX",
    annual: "price_pro_annual_XXXXXXXX",
  },
} as const;

export const PLAN_DISPLAY_PRICING = {
  base: {
    monthlyINR: 799,
    annualINR: 7990,
    annualMonthlyEquivalent: 666,
    annualSavingsINR: 1598,
  },
  pro: {
    monthlyINR: 1199,
    annualINR: 11990,
    annualMonthlyEquivalent: 999,
    annualSavingsINR: 2398,
  },
} as const;

export type PlanId = "base" | "pro";
export type BillingCycle = "monthly" | "annual";

export function getStripePriceId(plan: PlanId, cycle: BillingCycle): string {
  return STRIPE_PRICE_IDS[plan][cycle];
}
