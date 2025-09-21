import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// LLM Model selection types
export const LLM_MODELS = [
  "gpt-4o-mini",
  "gpt-5-nano", 
  "gpt-5-mini",
  "gpt-5"
] as const;

export type LLMModel = typeof LLM_MODELS[number];
export const DEFAULT_LLM_MODEL: LLMModel = "gpt-4o-mini";

export const experts = pgTable("experts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role").notNull(),
  specialization: text("specialization").notNull(),
  subSpecializations: jsonb("sub_specializations").default([]), // array of detailed specializations
  informationSources: jsonb("information_sources").default([]), // array of preferred information sources
  expertiseLevel: text("expertise_level").notNull().default("expert"), // expert, senior, specialist
  researchFocus: text("research_focus").default(""), // specific research focus area
  createdAt: timestamp("created_at").defaultNow(),
});

export const scenarios = pgTable("scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  theme: text("theme").notNull(),
  currentStrategy: text("current_strategy").notNull(),
  targetYears: jsonb("target_years").notNull(), // array of years like [2030, 2040, 2050]
  characterCount: text("character_count").notNull().default("1000"), // character limit for analysis (500-2500)
  model: text("model").notNull().default("gpt-4o-mini"), // LLM model selection
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar("scenario_id").references(() => scenarios.id).notNull(),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  progress: text("progress").notNull().default("0"), // percentage as string
  currentPhase: text("current_phase").notNull().default("1"),
  results: jsonb("results"), // stores the analysis results
  partialResults: jsonb("partial_results").default('{"expertAnalyses":[],"yearScenarios":[],"phaseResults":[]}'), // stores partial results for progressive display
  markdownReport: text("markdown_report"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExpertSchema = createInsertSchema(experts).omit({
  id: true,
  createdAt: true,
});

export const insertScenarioSchema = createInsertSchema(scenarios).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Expert = typeof experts.$inferSelect;
export type InsertExpert = z.infer<typeof insertExpertSchema>;
export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;

// Analysis result types for multi-year support
export interface ExpertAnalysis {
  expert: string;
  content: string;
  recommendations: string[];
}

export interface PhaseResult {
  phase: number;
  title: string;
  content: string;
  analyses?: ExpertAnalysis[];
  recommendations?: string[];
}

export interface YearResult {
  year: number;
  phases: PhaseResult[];
}

export interface AnalysisResults {
  years: YearResult[];
  phases?: PhaseResult[]; // Backward compatibility
}

// Partial result types for progressive display
export interface PartialExpertAnalysis {
  expert: string;
  year: number;
  content: string;
  recommendations: string[];
  completedAt: string;
}

export interface PartialYearScenario {
  year: number;
  content: string;
  completedAt: string;
}

export interface PartialPhaseResult {
  phase: number;
  title: string;
  content: string;
  completedAt: string;
}

export interface PartialResults {
  expertAnalyses: PartialExpertAnalysis[];
  yearScenarios: PartialYearScenario[];
  phaseResults: PartialPhaseResult[];
}
