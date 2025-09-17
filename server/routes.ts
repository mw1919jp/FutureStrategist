import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExpertSchema, insertScenarioSchema } from "@shared/schema";
import { openAIService } from "./services/openai";
import { registerSseRoute } from "./sse";
import { logPhaseStart, logPhaseComplete } from "./utils/logger";
import type { YearResult, PhaseResult, ExpertAnalysis, AnalysisResults } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register SSE route for real-time analysis logs
  registerSseRoute(app);

  // Expert routes
  app.get("/api/experts", async (req, res) => {
    try {
      const experts = await storage.getExperts();
      res.json(experts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch experts" });
    }
  });

  app.post("/api/experts", async (req, res) => {
    try {
      const expertData = insertExpertSchema.parse(req.body);
      const expert = await storage.createExpert(expertData);
      res.json(expert);
    } catch (error) {
      res.status(400).json({ message: "Invalid expert data" });
    }
  });

  app.delete("/api/experts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExpert(req.params.id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Expert not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expert" });
    }
  });

  // Expert prediction route
  app.post("/api/experts/predict", async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ message: "Valid expert name is required (minimum 2 characters)" });
      }

      const prediction = await openAIService.predictExpertInfo(name.trim());
      res.json(prediction);
    } catch (error) {
      console.error("Expert prediction error:", error);
      res.status(500).json({ message: "Failed to predict expert information" });
    }
  });

  // Scenario routes
  app.post("/api/scenarios", async (req, res) => {
    try {
      const scenarioData = insertScenarioSchema.parse(req.body);
      const scenario = await storage.createScenario(scenarioData);
      res.json(scenario);
    } catch (error) {
      res.status(400).json({ message: "Invalid scenario data" });
    }
  });

  app.get("/api/scenarios", async (req, res) => {
    try {
      const scenarios = await storage.getScenarios();
      res.json(scenarios);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scenarios" });
    }
  });

  // Analysis routes
  app.post("/api/analysis/start", async (req, res) => {
    try {
      const { scenarioId } = req.body;
      
      if (!scenarioId) {
        return res.status(400).json({ message: "Scenario ID is required" });
      }

      const scenario = await storage.getScenario(scenarioId);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found" });
      }

      // Create analysis record
      const analysis = await storage.createAnalysis({
        scenarioId,
        status: "running",
        progress: "0",
        currentPhase: "1",
        results: null,
        markdownReport: null,
      });

      // Start async analysis process
      processAnalysis(analysis.id, scenario).catch(console.error);

      res.json({ analysisId: analysis.id, status: "started" });
    } catch (error) {
      res.status(500).json({ message: "Failed to start analysis" });
    }
  });

  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analysis" });
    }
  });

  app.get("/api/analysis/:id/download", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis || !analysis.markdownReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="future-scenario-analysis-${analysis.id}.md"`);
      res.send(analysis.markdownReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to download report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processAnalysis(analysisId: string, scenario: any) {
  try {
    const targetYears = scenario.targetYears as number[];
    const experts = await storage.getExperts();
    const yearResults: YearResult[] = [];
    
    // Update to running status
    await storage.updateAnalysis(analysisId, {
      status: "running",
      progress: "0",
      currentPhase: "1"
    });

    // Calculate total steps for accurate progress tracking
    const totalYears = targetYears.length;
    const totalPhasesPerYear = 5;
    const totalSteps = totalYears * totalPhasesPerYear;
    
    let currentStep = 0;
    
    // Process each target year
    for (let yearIndex = 0; yearIndex < targetYears.length; yearIndex++) {
      const targetYear = targetYears[yearIndex];
      
      // Phase 1: Expert analysis for this year
      logPhaseStart(analysisId, 1, `${targetYear}年 - 専門家による専門分野の調査`);
      
      const expertAnalyses: ExpertAnalysis[] = [];
      for (const expert of experts) {
        const analysis = await openAIService.analyzeWithExpert(
          expert.name,
          expert.role,
          scenario.theme,
          scenario.currentStrategy,
          targetYear,
          analysisId
        );
        expertAnalyses.push(analysis);
      }
      
      logPhaseComplete(analysisId, 1, `${targetYear}年 - 専門家による専門分野の調査`);
      currentStep++;
      await storage.updateAnalysis(analysisId, {
        progress: String(Math.floor((currentStep / totalSteps) * 100)),
        currentPhase: "2"
      });

      // Phase 2: Scenario generation for this year
      logPhaseStart(analysisId, 2, `${targetYear}年 - シナリオ生成`);
      
      const scenarioContent = await openAIService.generateScenario(
        scenario.theme,
        scenario.currentStrategy,
        targetYear,
        expertAnalyses,
        analysisId
      );
      
      logPhaseComplete(analysisId, 2, `${targetYear}年 - シナリオ生成`);
      currentStep++;
      await storage.updateAnalysis(analysisId, {
        progress: String(Math.floor((currentStep / totalSteps) * 100)),
        currentPhase: "3"
      });

      // Phase 3: Long-term perspective for this year
      logPhaseStart(analysisId, 3, `${targetYear}年 - 超長期（2060年）からの戦略の見直し`);
      
      const longTermPerspective = await openAIService.generateLongTermPerspective(
        scenario.theme,
        scenario.currentStrategy,
        2060,
        targetYear,
        analysisId
      );
      
      logPhaseComplete(analysisId, 3, `${targetYear}年 - 超長期（2060年）からの戦略の見直し`);
      currentStep++;
      await storage.updateAnalysis(analysisId, {
        progress: String(Math.floor((currentStep / totalSteps) * 100)),
        currentPhase: "4"
      });

      // Phase 4: Strategic alignment evaluation for this year
      logPhaseStart(analysisId, 4, `${targetYear}年 - 戦略整合性評価`);
      
      const strategicAlignment = await openAIService.evaluateStrategicAlignment(
        scenario.theme,
        scenario.currentStrategy,
        targetYear,
        [scenarioContent, longTermPerspective],
        analysisId
      );
      
      logPhaseComplete(analysisId, 4, `${targetYear}年 - 戦略整合性評価`);
      currentStep++;
      await storage.updateAnalysis(analysisId, {
        progress: String(Math.floor((currentStep / totalSteps) * 100)),
        currentPhase: "5"
      });

      // Phase 5: Final simulation for this year
      logPhaseStart(analysisId, 5, `${targetYear}年 - 最終シナリオシミュレーション`);
      
      const finalSimulation = await openAIService.generateFinalSimulation(
        scenario.theme,
        scenario.currentStrategy,
        targetYear,
        [scenarioContent, longTermPerspective, strategicAlignment],
        analysisId
      );
      
      logPhaseComplete(analysisId, 5, `${targetYear}年 - 最終シナリオシミュレーション`);
      currentStep++;

      // Compile phases for this year
      const phases: PhaseResult[] = [
        {
          phase: 1,
          title: "専門家による専門分野の調査",
          content: "各専門家による分野別分析が完了しました。",
          analyses: expertAnalyses
        },
        {
          phase: 2,
          title: "シナリオ生成",
          content: scenarioContent
        },
        {
          phase: 3,
          title: "超長期（2060年）からの戦略の見直し",
          content: longTermPerspective
        },
        {
          phase: 4,
          title: "戦略整合性評価",
          content: strategicAlignment
        },
        {
          phase: 5,
          title: "最終シナリオシミュレーション",
          content: finalSimulation
        }
      ];

      yearResults.push({ year: targetYear, phases });
    }

    // Generate markdown report for all years
    const markdownReport = openAIService.generateMarkdownReportMultiYear(
      scenario.theme,
      scenario.currentStrategy,
      targetYears,
      yearResults
    );

    // Create results object with multi-year support
    const analysisResults: AnalysisResults = {
      years: yearResults,
      phases: yearResults[0]?.phases // Backward compatibility - show first year
    };

    // Final update
    await storage.updateAnalysis(analysisId, {
      status: "completed",
      progress: "100",
      currentPhase: "5",
      results: analysisResults,
      markdownReport
    });

  } catch (error) {
    console.error("Analysis processing error:", error);
    await storage.updateAnalysis(analysisId, {
      status: "failed",
      results: { error: error instanceof Error ? error.message : "Unknown error" }
    });
  }
}
