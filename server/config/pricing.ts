export const RAZORPAY_PLAN_IDS = {
  base: {
    monthly: "plan_base_monthly_XXXXXXXX",
    annual: "plan_base_annual_XXXXXXXX",
  },
  pro: {
    monthly: "plan_T6jHSDEbLQz5GU",
    annual: "plan_T6jIkMQie6c6Q6",
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

export const PLAN_AMOUNTS_PAISE = {
  base: { monthly: 79900, annual: 799000 },
  pro:  { monthly: 119900, annual: 1199000 },
} as const;

export const TEAM_PRICING = {
  consultant: { monthly: 599, annual: 5990 },
  resident:   { monthly: 399, annual: 3990 },
  minDoctors: 4,
} as const;

export type PlanId = "base" | "pro";
export type BillingCycle = "monthly" | "annual";

export function getRazorpayPlanId(plan: PlanId, cycle: BillingCycle): string {
  return RAZORPAY_PLAN_IDS[plan][cycle];
}
