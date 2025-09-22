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

// Zod validation schemas for evidence support
export const dataSourceSchema = z.object({
  name: z.string(),
  type: z.enum(['government', 'research', 'industry', 'academic', 'survey', 'report', 'database']),
  credibilityRating: z.number().min(1).max(5),
  url: z.string().optional(),
  datePublished: z.string().optional(),
  organization: z.string().optional(),
});

export const statisticalEvidenceSchema = z.object({
  metric: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  trend: z.enum(['increasing', 'decreasing', 'stable', 'volatile']).optional(),
  timeframe: z.string(),
  source: z.string(),
  confidenceLevel: z.number().min(0).max(100).optional(),
});

export const researchPaperSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string().optional(),
  year: z.number(),
  doi: z.string().optional(),
  url: z.string().optional(),
  relevanceScore: z.number().min(1).max(5),
  keyFindings: z.array(z.string()),
});

export const evidenceQualitySchema = z.object({
  overallRating: z.number().min(1).max(5),
  dataRecency: z.number().min(1).max(5),
  sourceReliability: z.number().min(1).max(5),
  sampleSize: z.string().optional(),
  limitations: z.array(z.string()),
  strengths: z.array(z.string()),
});

export const evidenceSupportSchema = z.object({
  dataSources: z.array(dataSourceSchema),
  statisticalEvidence: z.array(statisticalEvidenceSchema),
  researchPapers: z.array(researchPaperSchema),
  quality: evidenceQualitySchema,
  summaryStatement: z.string(),
});

export const reasoningStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  title: z.string(),
  description: z.string(),
  reasoning: z.string(),
  conclusion: z.string(),
  confidence: z.number().min(0).max(100),
  sources: z.array(z.string()).optional(),
  evidenceSupport: evidenceSupportSchema.optional(),
  timestamp: z.string(),
});

// Analysis result types for multi-year support
export interface ExpertAnalysis {
  expert: string;
  content: string;
  recommendations: string[];
  reasoningProcess?: ExpertReasoningProcess;
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
  reasoningProcess?: ExpertReasoningProcess;
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

// Evidence types for transparency
export interface DataSource {
  name: string;
  type: 'government' | 'research' | 'industry' | 'academic' | 'survey' | 'report' | 'database';
  credibilityRating: number; // 1-5 scale
  url?: string;
  datePublished?: string;
  organization?: string;
}

export interface StatisticalEvidence {
  metric: string;
  value: string | number;
  unit?: string;
  trend?: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  timeframe: string;
  source: string;
  confidenceLevel?: number; // percentage
}

export interface ResearchPaper {
  title: string;
  authors: string[];
  journal?: string;
  year: number;
  doi?: string;
  url?: string;
  relevanceScore: number; // 1-5 scale
  keyFindings: string[];
}

export interface EvidenceQuality {
  overallRating: number; // 1-5 scale
  dataRecency: number; // 1-5 scale (how recent is the data)
  sourceReliability: number; // 1-5 scale
  sampleSize?: string;
  limitations: string[];
  strengths: string[];
}

export interface EvidenceSupport {
  dataSources: DataSource[];
  statisticalEvidence: StatisticalEvidence[];
  researchPapers: ResearchPaper[];
  quality: EvidenceQuality;
  summaryStatement: string;
}

// Reasoning process types for thought visualization
export interface ReasoningStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  reasoning: string;
  conclusion: string;
  confidence: number; // 0-100
  sources?: string[]; // Keep for backward compatibility
  evidenceSupport?: EvidenceSupport; // New detailed evidence
  timestamp: string;
}

export interface ExpertReasoningProcess {
  expert: string;
  phase: number;
  steps: ReasoningStep[];
  finalConclusion: string;
  overallConfidence: number;
}
