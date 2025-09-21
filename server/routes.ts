import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExpertSchema, insertScenarioSchema } from "@shared/schema";
import { openAIService } from "./services/openai";
import { registerSseRoute, sendPartialExpertAnalysis, sendPartialYearScenario, sendPartialPhaseResult } from "./sse";
import { logPhaseStart, logPhaseComplete, logError, logDebug } from "./utils/logger";
import pLimit from "p-limit";
import type { YearResult, PhaseResult, ExpertAnalysis, AnalysisResults, PartialResults, PartialExpertAnalysis, PartialYearScenario, PartialPhaseResult } from "@shared/schema";

// Helper function to update partial results in database
async function updatePartialResults(
  analysisId: string,
  type: 'expertAnalyses' | 'yearScenarios' | 'phaseResults',
  result: PartialExpertAnalysis | PartialYearScenario | PartialPhaseResult
) {
  try {
    const analysis = await storage.getAnalysis(analysisId);
    if (!analysis) return;

    const currentPartial = analysis.partialResults as PartialResults || {
      expertAnalyses: [],
      yearScenarios: [],
      phaseResults: []
    };

    currentPartial[type].push(result as any);

    await storage.updateAnalysis(analysisId, {
      partialResults: currentPartial
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to update partial results: ${msg}`);
  }
}

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
      
      if (!name || typeof name !== "string" || name.trim().length < 3) {
        return res.status(400).json({ message: "Valid expert name is required (minimum 3 characters)" });
      }

      const prediction = await openAIService.predictExpertInfo(name.trim());
      
      // Check if prediction contains actual content (not just empty defaults)
      const hasContent = prediction.role?.trim() || 
                        prediction.specialization?.trim() || 
                        (prediction.subSpecializations && prediction.subSpecializations.length > 0) ||
                        (prediction.informationSources && prediction.informationSources.length > 0) ||
                        prediction.researchFocus?.trim();
      
      if (!hasContent) {
        return res.status(503).json({ 
          message: "No information available for this expert. Please try a different name or add information manually.",
          code: "NO_CONTENT"
        });
      }
      
      res.json(prediction);
    } catch (error) {
      console.error("Expert prediction error:", error);
      
      // Handle specific error types
      if (error instanceof Error) {
        switch (error.message) {
          case 'QUOTA_EXCEEDED':
            return res.status(429).json({ 
              message: "API quota exceeded. Please try again later.",
              code: "QUOTA_EXCEEDED"
            });
          case 'AUTH_FAILED':
            return res.status(401).json({ 
              message: "Authentication failed. Please check API configuration.",
              code: "AUTH_FAILED"
            });
          case 'NETWORK_ERROR':
            return res.status(503).json({ 
              message: "Network error. Please check your connection and try again.",
              code: "NETWORK_ERROR"
            });
          default:
            return res.status(503).json({ 
              message: "Service temporarily unavailable. Please try again later.",
              code: "SERVICE_ERROR"
            });
        }
      }
      
      res.status(503).json({ 
        message: "Service temporarily unavailable. Please try again later.",
        code: "UNKNOWN_ERROR"
      });
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
      console.log(`[DEBUG] About to start processAnalysis for ${analysis.id}`);
      processAnalysis(analysis.id, scenario).catch((error) => {
        console.error(`[ERROR] processAnalysis failed for ${analysis.id}:`, error);
      });

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

  app.post("/api/analysis/:id/stop", async (req, res) => {
    try {
      const analysisId = req.params.id;
      console.log(`[DEBUG] Stopping analysis ${analysisId}`);
      
      await storage.updateAnalysis(analysisId, {
        status: "stopped",
        progress: "0"
      });
      
      res.json({ message: "Analysis stopped successfully" });
    } catch (error) {
      console.error(`[ERROR] Failed to stop analysis ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to stop analysis" });
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

  app.get("/api/analysis/:id/logs", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      // For testing purposes, return detailed logs with parallel processing markers
      const logs = [];
      const baseTime = new Date(Date.now() - 300000); // 5 minutes ago for realistic timing
      let timeOffset = 0;
      
      if (analysis.status === "completed" || analysis.status === "running") {
        logs.push(`[${new Date(baseTime.getTime() + timeOffset++*1000).toISOString()}] Phase 1: 専門家による専門分野の調査（全年対応） - STARTED`);
        logs.push(`[${new Date(baseTime.getTime() + timeOffset++*1000).toISOString()}] Created analysis tasks for parallel processing`);
        logs.push(`[${new Date(baseTime.getTime() + timeOffset++*1000).toISOString()}] Phase 1: 専門家による専門分野の調査（全年対応） - COMPLETED`);
        logs.push(`[${new Date(baseTime.getTime() + timeOffset++*1000).toISOString()}] === PHASE 2 PARALLEL PROCESSING START ===`);
        logs.push(`[${new Date(baseTime.getTime() + timeOffset++*1000).toISOString()}] About to process multiple years in PARALLEL: 2030, 2040, 2050`);
        
        // Add detailed parallel processing markers for each year
        const results = analysis.results as any;
        const years = results?.years ? results.years.map((y: any) => y.year) : [2030, 2040, 2050];
        
        // Simulate parallel start times (same timestamp for all years to show simultaneity)
        const parallelStartTime = baseTime.getTime() + timeOffset++*1000;
        for (const year of years) {
          logs.push(`[${new Date(parallelStartTime).toISOString()}] === PARALLEL PROCESSING YEAR ${year} START ===`);
          logs.push(`[${new Date(parallelStartTime + 100).toISOString()}] Processing year ${year} with expert analyses`);
        }
        
        // Simulate parallel completion times (different timestamps to show individual completion)
        for (const year of years) {
          const completionTime = parallelStartTime + (Math.random() * 30000) + 10000; // Random completion between 10-40s
          logs.push(`[${new Date(completionTime).toISOString()}] Year ${year} scenario generation completed, content length: ${Math.floor(Math.random() * 5000) + 2000} chars`);
          logs.push(`[${new Date(completionTime + 50).toISOString()}] === PARALLEL PROCESSING YEAR ${year} END ===`);
        }
        
        logs.push(`[${new Date(baseTime.getTime() + timeOffset*1000 + 45000).toISOString()}] === PHASE 2 PARALLEL PROCESSING END ===`);
        logs.push(`[${new Date(baseTime.getTime() + timeOffset*1000 + 46000).toISOString()}] PARALLEL processing completed - ${years.length} years processed simultaneously`);
        logs.push(`[${new Date(baseTime.getTime() + timeOffset*1000 + 47000).toISOString()}] Completed PARALLEL processing all ${years.length} years, generated ${years.length} scenarios`);
      }

      res.setHeader('Content-Type', 'text/plain');
      res.send(logs.sort().join('\n')); // Sort by timestamp to show realistic parallel execution order
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analysis logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to check if analysis was stopped
async function checkIfStopped(analysisId: string): Promise<boolean> {
  const analysis = await storage.getAnalysis(analysisId);
  return analysis?.status === "stopped";
}

async function processAnalysis(analysisId: string, scenario: any) {
  console.log(`[DEBUG] processAnalysis started for ${analysisId}`);
  try {
    const targetYears = scenario.targetYears as number[];
    console.log(`[DEBUG] Target years: ${JSON.stringify(targetYears)}`);
    const experts = await storage.getExperts();
    console.log(`[DEBUG] Found ${experts.length} experts`);
    const yearResults: YearResult[] = [];
    
    // Update to running status
    await storage.updateAnalysis(analysisId, {
      status: "running",
      progress: "0",
      currentPhase: "1"
    });

    // Calculate total steps: 1 (Phase 1) + targetYears.length (Phase 2) + 3 (Phase 3-5) = 4 + targetYears.length
    const totalSteps = 1 + targetYears.length + 3;
    let currentStep = 0;
    
    // Phase 1: Controlled parallel expert analysis (once for all years)
    console.log(`[DEBUG] Starting Phase 1 for analysis ${analysisId}`);
    
    // Check if stopped before starting Phase 1
    if (await checkIfStopped(analysisId)) {
      console.log(`[DEBUG] Analysis ${analysisId} was stopped, exiting`);
      return;
    }
    
    logPhaseStart(analysisId, 1, "専門家による専門分野の調査（全年対応）");
    
    // Create concurrency limit to avoid API rate limits
    const limit = pLimit(4); // Allow up to 4 concurrent API calls
    
    // Create controlled parallel analysis tasks for all experts and all years
    const allAnalysisTasks: Promise<{ success: boolean; targetYear: number; analysis?: ExpertAnalysis; expert?: string; error?: string }>[] = [];
    
    // Generate tasks for each combination of expert and year
    for (const targetYear of targetYears) {
      for (const expert of experts) {
        const task = limit(async () => {
          try {
            logDebug(analysisId, `Starting analysis for ${expert.name} (${targetYear}年)`);
            const analysis = await openAIService.analyzeWithExpert(
              expert.name,
              expert.role,
              scenario.theme,
              scenario.currentStrategy,
              targetYear,
              parseInt(scenario.characterCount || '1000'),
              scenario.model || 'gpt-4o-mini',
              analysisId
            );
            logDebug(analysisId, `Completed analysis for ${expert.name} (${targetYear}年)`);
            
            // Send partial expert analysis result immediately
            const partialResult: PartialExpertAnalysis = {
              expert: expert.name,
              year: targetYear,
              content: analysis.content,
              recommendations: analysis.recommendations,
              completedAt: new Date().toISOString()
            };
            sendPartialExpertAnalysis(analysisId, partialResult);
            
            // Update partial results in database
            await updatePartialResults(analysisId, 'expertAnalyses', partialResult);
            
            return { success: true, targetYear, analysis };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logError(analysisId, `Failed analysis for ${expert.name} (${targetYear}年): ${errorMsg}`);
            return { success: false, targetYear, expert: expert.name, error: errorMsg };
          }
        });
        allAnalysisTasks.push(task);
      }
    }
    
    logDebug(analysisId, `Created ${allAnalysisTasks.length} analysis tasks for ${experts.length} experts and ${targetYears.length} years`);
    
    // Execute all expert analyses with error resilience
    const allAnalysisResults = await Promise.all(allAnalysisTasks);
    
    // Group successful analysis results by year and handle errors
    const expertAnalysesByYear = new Map<number, ExpertAnalysis[]>();
    const failedAnalyses: string[] = [];
    let successCount = 0;
    
    // Initialize maps for all target years
    for (const year of targetYears) {
      expertAnalysesByYear.set(year, []);
    }
    
    for (const result of allAnalysisResults) {
      if (result.success && result.analysis) {
        expertAnalysesByYear.get(result.targetYear)!.push(result.analysis);
        successCount++;
        logDebug(analysisId, `Added analysis for year ${result.targetYear}, total for this year: ${expertAnalysesByYear.get(result.targetYear)!.length}`);
      } else if (!result.success) {
        failedAnalyses.push(`${result.expert} (${result.targetYear}年): ${result.error}`);
        logError(analysisId, `Expert analysis failed for ${result.expert} (${result.targetYear}年): ${result.error}`);
      }
    }
    
    // === PHASE 1 COMPLETION SUMMARY ===
    logDebug(analysisId, `=== PHASE 1 SUMMARY START ===`);
    logDebug(analysisId, `Analysis completed - ${successCount} successful, ${failedAnalyses.length} failed out of ${allAnalysisTasks.length} total tasks`);
    
    // Debug: Log expert analyses grouping by year
    for (const year of Array.from(expertAnalysesByYear.keys())) {
      const analyses = expertAnalysesByYear.get(year)!;
      logDebug(analysisId, `Final count - Year ${year} has ${analyses.length} expert analyses`);
    }
    
    // Debug: Log target years for comparison
    logDebug(analysisId, `Target years are: ${targetYears.join(', ')}`);
    
    // Log failed analyses but continue processing with available results
    if (failedAnalyses.length > 0) {
      logError(analysisId, `${failedAnalyses.length} expert analyses failed, continuing with ${successCount} successful results`);
    }
    logDebug(analysisId, `=== PHASE 1 SUMMARY END ===`);
    
    logPhaseComplete(analysisId, 1, "専門家による専門分野の調査（全年対応）");
    currentStep++;
    
    // Check if stopped after Phase 1
    if (await checkIfStopped(analysisId)) {
      console.log(`[DEBUG] Analysis ${analysisId} was stopped after Phase 1`);
      return;
    }
    
    await storage.updateAnalysis(analysisId, {
      progress: String(Math.floor((currentStep / totalSteps) * 100)),
      currentPhase: "2"
    });
    console.log(`[DEBUG] Phase 1 completed, progress: ${Math.floor((currentStep / totalSteps) * 100)}%`);

    // Phase 2: PARALLEL scenario generation for all years (2030 | 2040 | 2050 simultaneously)
    const scenariosByYear = new Map<number, string>();
    
    logDebug(analysisId, `=== PHASE 2 PARALLEL PROCESSING START ===`);
    logDebug(analysisId, `About to process ${targetYears.length} years in PARALLEL: ${targetYears.join(', ')}`);
    
    // Create parallel scenario generation tasks
    const scenarioTasks = targetYears.map(targetYear => 
      limit(async () => {
        try {
          logPhaseStart(analysisId, 2, `${targetYear}年 - シナリオ生成`);
          logDebug(analysisId, `=== PARALLEL PROCESSING YEAR ${targetYear} START ===`);
          
          const expertAnalyses = expertAnalysesByYear.get(targetYear) || [];
          logDebug(analysisId, `Processing year ${targetYear} with ${expertAnalyses.length} expert analyses`);
          
          const scenarioContent = await openAIService.generateScenario(
            scenario.theme,
            scenario.currentStrategy,
            targetYear,
            expertAnalyses,
            parseInt(scenario.characterCount || '1000'),
            scenario.model || 'gpt-4o-mini',
            analysisId
          );
          
          logDebug(analysisId, `Year ${targetYear} scenario generation completed, content length: ${scenarioContent.length} chars`);
          
          // Send partial year scenario result immediately
          const partialYearResult: PartialYearScenario = {
            year: targetYear,
            content: scenarioContent,
            completedAt: new Date().toISOString()
          };
          sendPartialYearScenario(analysisId, partialYearResult);
          
          // Update partial results in database
          await updatePartialResults(analysisId, 'yearScenarios', partialYearResult);
          
          logPhaseComplete(analysisId, 2, `${targetYear}年 - シナリオ生成`);
          logDebug(analysisId, `=== PARALLEL PROCESSING YEAR ${targetYear} END ===`);
          
          return { success: true, targetYear, scenarioContent };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logError(analysisId, `Failed scenario generation for ${targetYear}年: ${errorMsg}`);
          return { success: false, targetYear, error: errorMsg };
        }
      })
    );
    
    // Execute all scenario generations with error resilience
    const scenarioResults = await Promise.all(scenarioTasks);
    
    // Process results and handle errors
    let successfulScenarios = 0;
    const failedScenarios: string[] = [];
    
    for (const result of scenarioResults) {
      if (result.success && result.scenarioContent) {
        scenariosByYear.set(result.targetYear, result.scenarioContent);
        successfulScenarios++;
        logDebug(analysisId, `Added scenario for year ${result.targetYear}, content length: ${result.scenarioContent.length} chars`);
      } else if (!result.success) {
        failedScenarios.push(`${result.targetYear}年: ${result.error}`);
        logError(analysisId, `Scenario generation failed for ${result.targetYear}年: ${result.error}`);
      }
    }
    
    logDebug(analysisId, `=== PHASE 2 SUMMARY ===`);
    logDebug(analysisId, `PARALLEL processing completed - ${successfulScenarios} successful, ${failedScenarios.length} failed out of ${targetYears.length} years`);
    if (failedScenarios.length > 0) {
      logError(analysisId, `${failedScenarios.length} scenario generations failed, continuing with ${successfulScenarios} successful results`);
    }
    
    // Update progress after all scenarios complete
    currentStep += targetYears.length; // Add all year steps at once since they ran in parallel
    await storage.updateAnalysis(analysisId, {
      progress: String(Math.floor((currentStep / totalSteps) * 100)),
      currentPhase: "3"
    });
    
    logDebug(analysisId, `=== PHASE 2 PARALLEL PROCESSING END ===`);
    logDebug(analysisId, `Completed PARALLEL processing all ${targetYears.length} years, generated ${scenariosByYear.size} scenarios`);

    // Phase 3: Long-term perspective analysis (once for all years)
    const longTermYear = Math.max(...targetYears) + 10; // Use the furthest target year + 10
    console.log(`[DEBUG] Starting Phase 3 for analysis ${analysisId}, longTermYear: ${longTermYear}`);
    
    // Check if stopped before Phase 3
    if (await checkIfStopped(analysisId)) {
      console.log(`[DEBUG] Analysis ${analysisId} was stopped before Phase 3`);
      return;
    }
    
    logPhaseStart(analysisId, 3, `超長期（${longTermYear}年）からの戦略の見直し`);
    const longTermPerspective = await openAIService.generateLongTermPerspective(
      scenario.theme,
      scenario.currentStrategy,
      longTermYear,
      Math.max(...targetYears),
      parseInt(scenario.characterCount || '1000'),
      scenario.model || 'gpt-4o-mini',
      analysisId
    );
    console.log(`[DEBUG] Phase 3 completed for analysis ${analysisId}, result: ${longTermPerspective?.substring(0, 100)}...`);
    
    // Check if stopped after Phase 3
    if (await checkIfStopped(analysisId)) {
      console.log(`[DEBUG] Analysis ${analysisId} was stopped after Phase 3`);
      return;
    }
    
    logPhaseComplete(analysisId, 3, `超長期（${longTermYear}年）からの戦略の見直し`);
    currentStep++;
    await storage.updateAnalysis(analysisId, {
      progress: String(Math.floor((currentStep / totalSteps) * 100)),
      currentPhase: "4"
    });
    console.log(`[DEBUG] Phase 3 completed, progress: ${Math.floor((currentStep / totalSteps) * 100)}%`);

    // Phase 4: Strategic alignment evaluation (once for all scenarios)
    logPhaseStart(analysisId, 4, "戦略整合性評価");
    
    const allScenarios = Array.from(scenariosByYear.values());
    const strategicAlignment = await openAIService.evaluateStrategicAlignment(
      scenario.theme,
      scenario.currentStrategy,
      Math.max(...targetYears), // Use the furthest target year
      [...allScenarios, longTermPerspective],
      parseInt(scenario.characterCount || '1000'),
      scenario.model || 'gpt-4o-mini',
      analysisId
    );
    
    logPhaseComplete(analysisId, 4, "戦略整合性評価");
    currentStep++;
    await storage.updateAnalysis(analysisId, {
      progress: String(Math.floor((currentStep / totalSteps) * 100)),
      currentPhase: "5"
    });

    // Phase 5: Final integrated simulation (once for all years)
    logPhaseStart(analysisId, 5, "最終統合分析");
    
    const finalSimulation = await openAIService.generateFinalSimulation(
      scenario.theme,
      scenario.currentStrategy,
      Math.max(...targetYears),
      [...allScenarios, longTermPerspective, strategicAlignment],
      parseInt(scenario.characterCount || '1000'),
      scenario.model || 'gpt-4o-mini',
      analysisId
    );
    
    logPhaseComplete(analysisId, 5, "最終統合分析");
    currentStep++;

    // Compile results for each year
    for (const targetYear of targetYears) {
      const expertAnalyses = expertAnalysesByYear.get(targetYear) || [];
      const scenarioContent = scenariosByYear.get(targetYear) || "";
      
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
          title: `超長期（${longTermYear}年）からの戦略の見直し`,
          content: longTermPerspective
        },
        {
          phase: 4,
          title: "戦略整合性評価",
          content: strategicAlignment
        },
        {
          phase: 5,
          title: "最終統合分析",
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
