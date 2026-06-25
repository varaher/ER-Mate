export const RAZORPAY_PLAN_IDS = {
  base: {
    monthly: "plan_base_monthly_XXXXXXXX",
    annual: "plan_base_annual_XXXXXXXX",
  },
  pro: {
    monthly: "plan_pro_monthly_XXXXXXXX",
    annual: "plan_pro_annual_XXXXXXXX",
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

export const CREDIT_PACKS = [
  { id: "pack50",  credits: 50,  amountPaise: 49900,  label: "50 Credits",  priceDisplay: "₹499" },
  { id: "pack100", credits: 100, amountPaise: 89900,  label: "100 Credits", priceDisplay: "₹899"  },
  { id: "pack300", credits: 300, amountPaise: 249900, label: "300 Credits", priceDisplay: "₹2,499" },
] as const;

export type PlanId = "base" | "pro";
export type BillingCycle = "monthly" | "annual";

export function getRazorpayPlanId(plan: PlanId, cycle: BillingCycle): string {
  return RAZORPAY_PLAN_IDS[plan][cycle];
}
