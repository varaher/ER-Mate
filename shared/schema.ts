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
