import { type Expert, type InsertExpert, type Scenario, type InsertScenario, type Analysis, type InsertAnalysis, experts, scenarios, analyses } from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Experts
  createExpert(expert: InsertExpert): Promise<Expert>;
  getExperts(): Promise<Expert[]>;
  deleteExpert(id: string): Promise<boolean>;

  // Scenarios
  createScenario(scenario: InsertScenario): Promise<Scenario>;
  getScenario(id: string): Promise<Scenario | undefined>;
  getScenarios(): Promise<Scenario[]>;

  // Analyses
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  updateAnalysis(id: string, updates: Partial<Analysis>): Promise<Analysis | undefined>;
  getAnalysesByScenario(scenarioId: string): Promise<Analysis[]>;
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export class PostgreSQLStorage implements IStorage {
  constructor() {
    // Initialize with default experts if they don't exist
    this.initializeDefaultExperts();
  }

  private async initializeDefaultExperts() {
    try {
      const existingExperts = await db.select().from(experts);
      if (existingExperts.length === 0) {
        const defaultExperts = [
          {
            name: "環境・自然学者",
            role: "環境科学、気候変動、持続可能性の専門家",
            specialization: "環境科学、気候変動、持続可能性",
          },
          {
            name: "AI専門家",
            role: "機械学習、データサイエンス、自動化技術の専門家",
            specialization: "機械学習、データサイエンス、自動化技術",
          },
          {
            name: "経済学者",
            role: "マクロ経済、金融市場、経済予測の専門家",
            specialization: "マクロ経済、金融市場、経済予測",
          }
        ];

        await db.insert(experts).values(defaultExperts);
      }
    } catch (error) {
      console.error("Failed to initialize default experts:", error);
    }
  }

  async createExpert(insertExpert: InsertExpert): Promise<Expert> {
    const [expert] = await db.insert(experts).values(insertExpert).returning();
    return expert;
  }

  async getExperts(): Promise<Expert[]> {
    return await db.select().from(experts);
  }

  async deleteExpert(id: string): Promise<boolean> {
    const result = await db.delete(experts).where(eq(experts.id, id));
    return result.rowCount !== undefined && result.rowCount > 0;
  }

  async createScenario(insertScenario: InsertScenario): Promise<Scenario> {
    const scenarioData = {
      ...insertScenario,
      agentCount: insertScenario.agentCount || "3",
      episodeCount: insertScenario.episodeCount || "20",
    };
    const [scenario] = await db.insert(scenarios).values(scenarioData).returning();
    return scenario;
  }

  async getScenario(id: string): Promise<Scenario | undefined> {
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, id));
    return scenario;
  }

  async getScenarios(): Promise<Scenario[]> {
    return await db.select().from(scenarios);
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const analysisData = {
      ...insertAnalysis,
      status: insertAnalysis.status || "pending",
      progress: insertAnalysis.progress || "0",
      currentPhase: insertAnalysis.currentPhase || "1",
      results: insertAnalysis.results || null,
      markdownReport: insertAnalysis.markdownReport || null,
    };
    const [analysis] = await db.insert(analyses).values(analysisData).returning();
    return analysis;
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id));
    return analysis;
  }

  async updateAnalysis(id: string, updates: Partial<Analysis>): Promise<Analysis | undefined> {
    const [analysis] = await db.update(analyses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(analyses.id, id))
      .returning();
    return analysis;
  }

  async getAnalysesByScenario(scenarioId: string): Promise<Analysis[]> {
    return await db.select().from(analyses).where(eq(analyses.scenarioId, scenarioId));
  }
}

export const storage = new PostgreSQLStorage();
