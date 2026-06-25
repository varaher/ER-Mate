---
name: Razorpay integration approach
description: How Razorpay payments are integrated in ErMate — API approach, key files, and webhook setup requirements.
---

## Approach
Uses **Razorpay Payment Links API** (REST + Basic auth with key_id:key_secret). No native SDK or npm package required — pure `fetch` calls. Works perfectly with `expo-web-browser` on all platforms.

**Why Payment Links (not Subscriptions/Orders):** Subscriptions API requires pre-created plan IDs in the Razorpay dashboard. Payment Links work immediately with just API keys.

## Key files
- `server/services/razorpayService.ts` — `createPaymentLink()`, `createOrder()`, `verifyWebhookSignature()`
- `server/config/pricing.ts` — `PLAN_AMOUNTS_PAISE`, `CREDIT_PACKS` (amounts in paise = INR × 100)
- `server/services/subscription.ts` — `activatePlan(userId, plan, cycle, razorpayPaymentLinkId)` activates after webhook

## Flow
1. `POST /api/subscription/create-checkout` → creates payment link → returns `{url}`
2. Client: `WebBrowser.openBrowserAsync(url)` opens Razorpay's hosted checkout
3. User pays → Razorpay fires `payment_link.paid` webhook → `POST /api/webhooks/razorpay`
4. Server verifies signature, calls `activatePlan()`, stores in local DB

## Webhook setup (required in Razorpay dashboard)
- URL: `https://er-mate.replit.app/api/webhooks/razorpay`
- Events: `payment_link.paid`, `subscription.activated`, `subscription.cancelled`
- Secret: add as `RAZORPAY_WEBHOOK_SECRET` Replit secret

## Credit packs
- `POST /api/subscription/create-credit-order` → same payment link flow with `type=credits` in notes
- Credits managed on external backend; webhook logs for manual processing

## DB columns added
`subscriptions` table: `razorpay_payment_link_id`, `razorpay_subscription_id`, `billing_cycle`

## Environment variables
- `RAZORPAY_KEY_ID` — Replit secret (set)
- `RAZORPAY_KEY_SECRET` — Replit secret (set)
- `RAZORPAY_WEBHOOK_SECRET` — Replit secret (NOT set yet — user must add after configuring webhook in Razorpay dashboard)
