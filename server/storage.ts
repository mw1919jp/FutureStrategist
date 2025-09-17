import { type Expert, type InsertExpert, type Scenario, type InsertScenario, type Analysis, type InsertAnalysis } from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private experts: Map<string, Expert>;
  private scenarios: Map<string, Scenario>;
  private analyses: Map<string, Analysis>;

  constructor() {
    this.experts = new Map();
    this.scenarios = new Map();
    this.analyses = new Map();

    // Initialize with default experts
    const defaultExperts = [
      {
        id: randomUUID(),
        name: "環境・自然学者",
        role: "環境科学、気候変動、持続可能性の専門家",
        specialization: "環境科学、気候変動、持続可能性",
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        name: "AI専門家",
        role: "機械学習、データサイエンス、自動化技術の専門家",
        specialization: "機械学習、データサイエンス、自動化技術",
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        name: "経済学者",
        role: "マクロ経済、金融市場、経済予測の専門家",
        specialization: "マクロ経済、金融市場、経済予測",
        createdAt: new Date(),
      }
    ];

    defaultExperts.forEach(expert => this.experts.set(expert.id, expert));
  }

  async createExpert(insertExpert: InsertExpert): Promise<Expert> {
    const id = randomUUID();
    const expert: Expert = {
      ...insertExpert,
      id,
      createdAt: new Date(),
    };
    this.experts.set(id, expert);
    return expert;
  }

  async getExperts(): Promise<Expert[]> {
    return Array.from(this.experts.values());
  }

  async deleteExpert(id: string): Promise<boolean> {
    return this.experts.delete(id);
  }

  async createScenario(insertScenario: InsertScenario): Promise<Scenario> {
    const id = randomUUID();
    const scenario: Scenario = {
      ...insertScenario,
      id,
      agentCount: insertScenario.agentCount || "3",
      episodeCount: insertScenario.episodeCount || "20",
      createdAt: new Date(),
    };
    this.scenarios.set(id, scenario);
    return scenario;
  }

  async getScenario(id: string): Promise<Scenario | undefined> {
    return this.scenarios.get(id);
  }

  async getScenarios(): Promise<Scenario[]> {
    return Array.from(this.scenarios.values());
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = randomUUID();
    const analysis: Analysis = {
      ...insertAnalysis,
      id,
      status: insertAnalysis.status || "pending",
      progress: insertAnalysis.progress || "0",
      currentPhase: insertAnalysis.currentPhase || "1",
      results: insertAnalysis.results || null,
      markdownReport: insertAnalysis.markdownReport || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async updateAnalysis(id: string, updates: Partial<Analysis>): Promise<Analysis | undefined> {
    const existing = this.analyses.get(id);
    if (!existing) return undefined;
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.analyses.set(id, updated);
    return updated;
  }

  async getAnalysesByScenario(scenarioId: string): Promise<Analysis[]> {
    return Array.from(this.analyses.values()).filter(
      analysis => analysis.scenarioId === scenarioId
    );
  }
}

export const storage = new MemStorage();
