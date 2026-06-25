import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, serial, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const aiFeedback = pgTable("ai_feedback", {
  id: serial("id").primaryKey(),
  suggestionId: text("suggestion_id").notNull(),
  caseId: text("case_id").notNull(),
  feedbackType: text("feedback_type").notNull(),
  userCorrection: text("user_correction"),
  suggestionText: text("suggestion_text"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAIFeedbackSchema = createInsertSchema(aiFeedback).omit({
  id: true,
  createdAt: true,
});

export type AIFeedbackRecord = typeof aiFeedback.$inferSelect;
export type InsertAIFeedback = z.infer<typeof insertAIFeedbackSchema>;

export const treatmentHistory = pgTable("treatment_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  diagnosis: text("diagnosis").notNull(),
  drugName: text("drug_name").notNull(),
  dose: text("dose"),
  route: text("route"),
  frequency: text("frequency"),
  drugType: text("drug_type").default("medication"),
  dilution: text("dilution"),
  rate: text("rate"),
  ageGroup: text("age_group"),
  patientAge: text("patient_age"),
  patientSex: text("patient_sex"),
  caseId: text("case_id"),
  usageCount: integer("usage_count").default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTreatmentHistorySchema = createInsertSchema(treatmentHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TreatmentHistoryRecord = typeof treatmentHistory.$inferSelect;
export type InsertTreatmentHistory = z.infer<typeof insertTreatmentHistorySchema>;

export const emReferenceFeedback = pgTable("em_reference_feedback", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull(),
  query: text("query").notNull(),
  response: text("response").notNull(),
  topic: text("topic"),
  feedbackType: text("feedback_type").notNull(),
  feedbackComment: text("feedback_comment"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertEMReferenceFeedbackSchema = createInsertSchema(emReferenceFeedback).omit({
  id: true,
  createdAt: true,
});

export type EMReferenceFeedbackRecord = typeof emReferenceFeedback.$inferSelect;
export type InsertEMReferenceFeedback = z.infer<typeof insertEMReferenceFeedbackSchema>;

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  casesUsed: integer("cases_used").notNull().default(0),
  casesLimit: integer("cases_limit").notNull().default(10),
  currentPeriodStart: timestamp("current_period_start").default(sql`CURRENT_TIMESTAMP`),
  currentPeriodEnd: timestamp("current_period_end"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SubscriptionRecord = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export const userFeedback = pgTable("user_feedback", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  userEmail: text("user_email"),
  userName: text("user_name"),
  category: text("category").notNull().default("general"),
  message: text("message").notNull(),
  platform: text("platform"),
  appVersion: text("app_version"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type UserFeedbackRecord = typeof userFeedback.$inferSelect;
export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;

export const caseClinicalData = pgTable("case_clinical_data", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  userId: text("user_id").notNull(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCaseClinicalDataSchema = createInsertSchema(caseClinicalData).omit({
  id: true,
  updatedAt: true,
});

export type CaseClinicalDataRecord = typeof caseClinicalData.$inferSelect;
export type InsertCaseClinicalData = z.infer<typeof insertCaseClinicalDataSchema>;

// ═══════════════════════════════════════════════════════════════
// TEAM SYSTEM — added June 2026
// All userId fields are text (UUID) to match existing users table
// caseId fields are text references to external backend (no FK)
// ═══════════════════════════════════════════════════════════════

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hospitalName: text("hospital_name"),
  hodUserId: text("hod_user_id").notNull(),
  maxConcurrent: integer("max_concurrent").default(8),
  allowOverflow: boolean("allow_overflow").default(true),
  plan: text("plan").default("team"),
  billingActive: boolean("billing_active").default(false),
  paymentSubscriptionId: text("payment_subscription_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const departmentMembers = pgTable("department_members", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  status: text("status").default("pending"),
  invitedAt: timestamp("invited_at").default(sql`CURRENT_TIMESTAMP`),
  joinedAt: timestamp("joined_at"),
  removedAt: timestamp("removed_at"),
});

export const departmentInvites = pgTable("department_invites", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  maxConsultants: integer("max_consultants").default(2),
  maxResidents: integer("max_residents").default(6),
});

export const shiftSessions = pgTable("shift_sessions", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").notNull(),
  departmentId: integer("department_id").notNull(),
  userId: text("user_id").notNull(),
  roleForShift: text("role_for_shift").notNull(),
  checkedInAt: timestamp("checked_in_at").default(sql`CURRENT_TIMESTAMP`),
  checkedOutAt: timestamp("checked_out_at"),
  status: text("status").default("active"),
  forceLogoutBy: text("force_logout_by"),
  forceLogoutAt: timestamp("force_logout_at"),
});

export const caseOverlays = pgTable("case_overlays", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  departmentId: integer("department_id").notNull(),
  shiftSessionId: integer("shift_session_id"),
  handoverStatus: text("handover_status").default("active"),
  handedOverToShiftId: integer("handed_over_to_shift_id"),
  handedOverByUserId: text("handed_over_by_user_id"),
  handedOverAt: timestamp("handed_over_at"),
  receivedByUserId: text("received_by_user_id"),
  receivedAt: timestamp("received_at"),
  bedNumber: text("bed_number"),
  pendingNotes: text("pending_notes"),
  consultantReviewedBy: text("consultant_reviewed_by"),
  consultantReviewedAt: timestamp("consultant_reviewed_at"),
  consultantNote: text("consultant_note"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const escalations = pgTable("escalations", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  departmentId: integer("department_id").notNull(),
  fromResidentId: text("from_resident_id").notNull(),
  toConsultantId: text("to_consultant_id"),
  reason: text("reason"),
  escalatedAt: timestamp("escalated_at").default(sql`CURRENT_TIMESTAMP`),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  status: text("status").default("pending"),
});

export const departmentBilling = pgTable("department_billing", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  consultantCount: integer("consultant_count").default(0),
  residentCount: integer("resident_count").default(0),
  consultantRateMonthly: integer("consultant_rate").default(59900),
  residentRateMonthly: integer("resident_rate").default(39900),
  billingCycle: text("billing_cycle").default("monthly"),
  paymentSubscriptionId: text("payment_subscription_id"),
  paymentCustomerId: text("payment_customer_id"),
  status: text("status").default("pending"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
});

export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull(),
  platform: text("platform"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
