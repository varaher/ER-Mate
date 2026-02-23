import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, serial, integer } from "drizzle-orm/pg-core";
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
