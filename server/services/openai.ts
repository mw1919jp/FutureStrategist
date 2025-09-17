import OpenAI from "openai";
import { logApiRequest, logApiResponse } from "../utils/logger";
import type { YearResult } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

// Ultra-fast OpenAI client specifically for expert prediction with no retries and 1.8s timeout
const fastOpenai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key",
  maxRetries: 0,
  timeout: 1800, // 1.8 second timeout to guarantee <2s total response
});

// In-memory cache for expert predictions with TTL
interface CacheEntry {
  data: ExpertPrediction;
  timestamp: number;
  ttl: number;
}

// Circuit breaker state management
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const predictionCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<ExpertPrediction>>();
const circuitBreaker = new Map<string, CircuitBreakerState>();

// Cache TTL: 15 minutes
const CACHE_TTL = 15 * 60 * 1000;
// Circuit breaker timeout: 10 seconds
const CIRCUIT_BREAKER_TIMEOUT = 10 * 1000;
// Hard deadline for total response: 2 seconds
const HARD_DEADLINE = 2000;

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

export interface ScenarioAnalysisResult {
  phases: PhaseResult[];
  finalRecommendations: string[];
  markdownReport: string;
}

export interface ExpertPrediction {
  role: string;
  specialization: string;
  expertiseLevel: string;
  subSpecializations: string[];
  informationSources: string[];
  researchFocus: string;
}

// Template-based fallback responses for common expert types
const expertFallbackTemplates: Record<string, ExpertPrediction> = {
  "AI研究者": {
    role: "人工知能研究・開発専門家",
    specialization: "機械学習・深層学習",
    expertiseLevel: "expert",
    subSpecializations: ["自然言語処理", "コンピュータビジョン", "強化学習"],
    informationSources: ["学術論文", "技術カンファレンス"],
    researchFocus: "AI技術の実用化と倫理的課題"
  },
  "経営コンサルタント": {
    role: "企業戦略・経営改善専門家",
    specialization: "経営戦略・組織変革",
    expertiseLevel: "senior",
    subSpecializations: ["デジタル変革", "事業再編", "組織開発"],
    informationSources: ["市場調査", "業界レポート"],
    researchFocus: "持続的競争優位の構築"
  },
  "経済学者": {
    role: "経済分析・政策研究専門家",
    specialization: "マクロ経済・金融政策",
    expertiseLevel: "expert",
    subSpecializations: ["金融市場", "国際経済", "労働経済"],
    informationSources: ["統計データ", "政府報告書"],
    researchFocus: "経済動向と政策効果の分析"
  },
  "技術者": {
    role: "技術開発・システム設計専門家",
    specialization: "ソフトウェア・システム開発",
    expertiseLevel: "expert",
    subSpecializations: ["クラウド技術", "データベース", "セキュリティ"],
    informationSources: ["技術文書", "開発コミュニティ"],
    researchFocus: "技術革新と実装効率の向上"
  },
  "マーケティング専門家": {
    role: "市場分析・顧客戦略専門家",
    specialization: "デジタルマーケティング",
    expertiseLevel: "expert",
    subSpecializations: ["ソーシャルメディア", "データ分析", "ブランド戦略"],
    informationSources: ["消費者調査", "市場データ"],
    researchFocus: "顧客体験の最適化と収益向上"
  }
};

export class OpenAIService {
  // Cache management methods
  private getCachedPrediction(expertName: string): ExpertPrediction | null {
    const entry = predictionCache.get(expertName);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      predictionCache.delete(expertName);
      return null;
    }
    
    console.log(`[ExpertPrediction] Cache hit for ${expertName}`);
    return entry.data;
  }

  private cachePrediction(expertName: string, prediction: ExpertPrediction): void {
    predictionCache.set(expertName, {
      data: prediction,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });
  }

  // Circuit breaker management
  private shouldBreakCircuit(expertName: string): boolean {
    const state = circuitBreaker.get(expertName);
    if (!state) return false;
    
    const now = Date.now();
    if (state.isOpen && (now - state.lastFailureTime) > CIRCUIT_BREAKER_TIMEOUT) {
      // Reset circuit breaker after timeout
      circuitBreaker.delete(expertName);
      console.log(`[ExpertPrediction] Circuit breaker reset for ${expertName}`);
      return false;
    }
    
    if (state.isOpen) {
      console.log(`[ExpertPrediction] Circuit breaker open for ${expertName}, using fallback`);
      return true;
    }
    
    return false;
  }

  private recordCircuitBreakerFailure(expertName: string, error: any): void {
    const now = Date.now();
    const state = circuitBreaker.get(expertName) || { failureCount: 0, lastFailureTime: 0, isOpen: false };
    
    // Check for known failure conditions
    const isKnownFailure = 
      error.code === 'insufficient_quota' ||
      error.status === 429 ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('Request timed out') ||
      error.message?.includes('timeout');
    
    if (isKnownFailure) {
      state.failureCount += 1;
      state.lastFailureTime = now;
      state.isOpen = state.failureCount >= 2; // Open circuit after 2 failures
      
      circuitBreaker.set(expertName, state);
      console.log(`[ExpertPrediction] Circuit breaker failure recorded for ${expertName}. Count: ${state.failureCount}, Open: ${state.isOpen}`);
    }
  }

  private getFallbackPrediction(expertName: string): ExpertPrediction {
    // Check for exact matches first
    const exactMatch = expertFallbackTemplates[expertName];
    if (exactMatch) {
      return exactMatch;
    }

    // Check for partial matches in expert name
    for (const [templateKey, template] of Object.entries(expertFallbackTemplates)) {
      if (expertName.includes(templateKey) || templateKey.includes(expertName)) {
        return {
          ...template,
          role: `${expertName} - ${template.role}`
        };
      }
    }

    // Generic fallback
    return {
      role: `${expertName} - 専門分野の専門家`,
      specialization: "専門分野",
      expertiseLevel: "expert",
      subSpecializations: ["専門領域1", "専門領域2", "専門領域3"],
      informationSources: ["専門文献", "業界情報"],
      researchFocus: "分野の発展と実用化"
    };
  }

  async predictExpertInfo(expertName: string): Promise<ExpertPrediction> {
    const startTime = Date.now();
    
    console.log(`[ExpertPrediction] Request started for: ${expertName}`);

    // 1. Check cache first (fastest path)
    const cached = this.getCachedPrediction(expertName);
    if (cached) {
      const elapsedTime = Date.now() - startTime;
      console.log(`[ExpertPrediction] Cache hit for ${expertName} in ${elapsedTime}ms`);
      return cached;
    }

    // 2. Check inflight deduplication
    const existingRequest = inflightRequests.get(expertName);
    if (existingRequest) {
      console.log(`[ExpertPrediction] Joining inflight request for ${expertName}`);
      try {
        const result = await existingRequest;
        const elapsedTime = Date.now() - startTime;
        console.log(`[ExpertPrediction] Inflight request completed for ${expertName} in ${elapsedTime}ms`);
        return result;
      } catch (error) {
        // If inflight request failed, continue with new request
        console.log(`[ExpertPrediction] Inflight request failed for ${expertName}, trying new request`);
      }
    }

    // 3. Check circuit breaker (fast-fail on known failures)
    if (this.shouldBreakCircuit(expertName)) {
      const fallbackResult = this.getFallbackPrediction(expertName);
      this.cachePrediction(expertName, fallbackResult);
      const elapsedTime = Date.now() - startTime;
      console.log(`[ExpertPrediction] Circuit breaker fallback for ${expertName} in ${elapsedTime}ms`);
      return fallbackResult;
    }

    // 4. Create new API request with hard deadline enforcement
    const requestPromise = this.makeApiRequestWithDeadline(expertName, startTime);
    inflightRequests.set(expertName, requestPromise);

    try {
      const result = await requestPromise;
      
      // Success: cache result and clear inflight
      this.cachePrediction(expertName, result);
      inflightRequests.delete(expertName);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`[ExpertPrediction] API success for ${expertName} in ${elapsedTime}ms`);
      return result;
      
    } catch (error) {
      // Failure: record in circuit breaker, clear inflight, return fallback
      this.recordCircuitBreakerFailure(expertName, error);
      inflightRequests.delete(expertName);
      
      const fallbackResult = this.getFallbackPrediction(expertName);
      this.cachePrediction(expertName, fallbackResult);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`[ExpertPrediction] API error for ${expertName} after ${elapsedTime}ms, using fallback`);
      return fallbackResult;
    }
  }

  private async makeApiRequestWithDeadline(expertName: string, requestStartTime: number): Promise<ExpertPrediction> {
    const remainingTime = HARD_DEADLINE - (Date.now() - requestStartTime);
    if (remainingTime <= 100) { // Less than 100ms remaining
      throw new Error('Hard deadline exceeded before API call');
    }

    // Create AbortController for hard deadline enforcement
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, Math.min(remainingTime - 50, 1800)); // Leave 50ms buffer, max 1800ms

    try {
      const prompt = `専門家名: ${expertName}

以下のJSON形式で簡潔に回答:
{
  "role": "簡潔な役割（1行）",
  "specialization": "主要専門分野",
  "expertiseLevel": "specialist/expert/senior のいずれか",
  "subSpecializations": ["領域1", "領域2", "領域3"],
  "informationSources": ["情報源1", "情報源2"],
  "researchFocus": "研究フォーカス（簡潔に）"
}

要点を絞り実用的な内容で日本語回答。`;

      console.log(`[ExpertPrediction] Making API call for ${expertName} with ${remainingTime}ms remaining`);
      
      const response = await fastOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 150,
        temperature: 0.7,
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseContent = response.choices[0].message.content || "{}";
      const result = JSON.parse(responseContent);
      
      // Validate and set defaults if needed
      return {
        role: result.role || "",
        specialization: result.specialization || "",
        expertiseLevel: ["specialist", "expert", "senior"].includes(result.expertiseLevel) 
          ? result.expertiseLevel 
          : "expert",
        subSpecializations: Array.isArray(result.subSpecializations) 
          ? result.subSpecializations 
          : [],
        informationSources: Array.isArray(result.informationSources) 
          ? result.informationSources 
          : [],
        researchFocus: result.researchFocus || "",
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Check if it's an abort error (our timeout) or API error
      if (controller.signal.aborted) {
        throw new Error('Request aborted due to hard deadline');
      }
      
      throw error;
    }
  }

  async analyzeWithExpert(
    expertName: string, 
    expertRole: string, 
    theme: string, 
    currentStrategy: string, 
    targetYear: number,
    analysisId?: string
  ): Promise<ExpertAnalysis> {
    try {
      const prompt = `あなたは「${expertName}」として、以下の分析を行ってください。

専門分野: ${expertRole}

分析対象:
- 未来テーマ: ${theme}
- 現在の経営戦略: ${currentStrategy}
- 予測年: ${targetYear}年

${expertName}の視点から、${targetYear}年における上記テーマの影響と、現在の経営戦略に対する専門的な助言を提供してください。
具体的な課題、機会、推奨事項を含めて分析してください。

JSON形式で以下の構造で回答してください:
{
  "analysis": "詳細な分析内容（500文字程度）",
  "recommendations": ["推奨事項1", "推奨事項2", "推奨事項3"]
}`;

      if (analysisId) {
        logApiRequest(analysisId, 1, `専門家分析: ${expertName}`, prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 1, `専門家分析: ${expertName}`, true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      
      return {
        expert: expertName,
        content: result.analysis || "分析結果を取得できませんでした。",
        recommendations: result.recommendations || [],
      };
    } catch (error) {
      console.error("Expert analysis error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 1, `専門家分析: ${expertName}`, false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return {
        expert: expertName,
        content: `${expertName}による分析中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        recommendations: [],
      };
    }
  }

  async generateScenario(
    theme: string,
    currentStrategy: string,
    targetYear: number,
    expertAnalyses: ExpertAnalysis[],
    analysisId?: string
  ): Promise<string> {
    try {
      const expertSummary = expertAnalyses.map(analysis => 
        `${analysis.expert}: ${analysis.content}`
      ).join('\n\n');

      const prompt = `以下の専門家分析を基に、${targetYear}年における具体的なシナリオを生成してください。

未来テーマ: ${theme}
現在の経営戦略: ${currentStrategy}
予測年: ${targetYear}年

専門家分析:
${expertSummary}

上記の分析を統合し、${targetYear}年に起こりうる具体的なシナリオを詳細に描写してください。
シナリオには以下を含めてください:
1. 社会・技術・経済環境の変化
2. 現在の戦略への影響
3. 企業が直面する課題と機会
4. 推奨される対応策

JSON形式で以下の構造で回答してください:
{
  "scenario": "詳細なシナリオ（800文字程度）"
}`;

      if (analysisId) {
        logApiRequest(analysisId, 2, "シナリオ生成", prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 2, "シナリオ生成", true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      return result.scenario || "シナリオの生成に失敗しました。";
    } catch (error) {
      console.error("Scenario generation error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 2, "シナリオ生成", false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return `シナリオ生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
    }
  }

  async generateLongTermPerspective(
    theme: string,
    currentStrategy: string,
    longTermYear: number,
    nearTermYear: number,
    analysisId?: string
  ): Promise<string> {
    try {
      const prompt = `${longTermYear}年の視点から${nearTermYear}年の戦略を評価し、超長期的な観点での提言を行ってください。

未来テーマ: ${theme}
現在の経営戦略: ${currentStrategy}
長期視点年: ${longTermYear}年
評価対象年: ${nearTermYear}年

${longTermYear}年から振り返って、${nearTermYear}年時点で重要になる要素と、現在取るべき戦略的アクションを分析してください。

JSON形式で以下の構造で回答してください:
{
  "perspective": "長期的な視点からの分析（600文字程度）",
  "key_factors": ["重要要素1", "重要要素2", "重要要素3"],
  "strategic_actions": ["戦略的アクション1", "戦略的アクション2", "戦略的アクション3"]
}`;

      if (analysisId) {
        logApiRequest(analysisId, 3, "長期視点分析", prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 3, "長期視点分析", true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      return result.perspective || "長期的視点の分析に失敗しました。";
    } catch (error) {
      console.error("Long-term perspective error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 3, "長期視点分析", false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return `長期的視点の分析中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
    }
  }

  async evaluateStrategicAlignment(
    theme: string,
    currentStrategy: string,
    targetYear: number,
    scenarios: string[],
    analysisId?: string
  ): Promise<string> {
    try {
      const scenarioSummary = scenarios.join('\n\n');

      const prompt = `以下のシナリオ分析に基づいて、現在の経営戦略の整合性を評価してください。

未来テーマ: ${theme}
現在の経営戦略: ${currentStrategy}
予測年: ${targetYear}年

生成されたシナリオ:
${scenarioSummary}

現在の経営戦略がこれらのシナリオにどの程度適合しているか、また戦略修正の必要性について評価してください。

JSON形式で以下の構造で回答してください:
{
  "alignment_score": "1-10のスコア",
  "strengths": ["強み・機会1", "強み・機会2", "強み・機会3"],
  "weaknesses": ["課題・リスク1", "課題・リスク2", "課題・リスク3"],
  "recommendations": ["推奨事項1", "推奨事項2", "推奨事項3"]
}`;

      if (analysisId) {
        logApiRequest(analysisId, 4, "戦略整合性評価", prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 4, "戦略整合性評価", true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      return JSON.stringify(result);
    } catch (error) {
      console.error("Strategic alignment evaluation error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 4, "戦略整合性評価", false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return JSON.stringify({
        alignment_score: "評価不可",
        strengths: ["評価中にエラーが発生しました"],
        weaknesses: [error instanceof Error ? error.message : "不明なエラー"],
        recommendations: ["後で再度実行してください"]
      });
    }
  }

  async generateFinalSimulation(
    theme: string,
    currentStrategy: string,
    targetYear: number,
    allAnalyses: string[],
    analysisId?: string
  ): Promise<string> {
    try {
      const analysisSummary = allAnalyses.join('\n\n');

      const prompt = `これまでの全ての分析を統合し、最終的なシナリオシミュレーションを生成してください。

未来テーマ: ${theme}
現在の経営戦略: ${currentStrategy}
予測年: ${targetYear}年

統合分析:
${analysisSummary}

上記の全分析を統合し、最も実現可能性の高い未来シナリオと、企業が取るべき具体的な戦略を提示してください。

JSON形式で以下の構造で回答してください:
{
  "final_scenario": "最終統合シナリオ（800文字程度）",
  "strategic_priorities": ["優先戦略1", "優先戦略2", "優先戦略3"],
  "success_factors": ["成功要因1", "成功要因2", "成功要因3"],
  "implementation_steps": ["実装ステップ1", "実装ステップ2", "実装ステップ3"]
}`;

      if (analysisId) {
        logApiRequest(analysisId, 5, "最終シミュレーション", prompt);
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content || "{}";
      if (analysisId) {
        logApiResponse(analysisId, 5, "最終シミュレーション", true, responseContent.length);
      }

      const result = JSON.parse(responseContent);
      return result.final_scenario || "最終シミュレーションの生成に失敗しました。";
    } catch (error) {
      console.error("Final simulation error:", error);
      if (analysisId) {
        logApiResponse(analysisId, 5, "最終シミュレーション", false, 0, error instanceof Error ? error.message : '不明なエラー');
      }
      return `最終シミュレーション中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
    }
  }

  generateMarkdownReport(
    theme: string,
    currentStrategy: string,
    targetYears: number[],
    phases: PhaseResult[]
  ): string {
    const date = new Date().toISOString().split('T')[0];
    
    let markdown = `# 未来予測AIシナリオ分析レポート

**生成日:** ${date}
**分析テーマ:** ${theme}
**現在の経営戦略:** ${currentStrategy}
**予測年:** ${targetYears.join(', ')}

---

## 📋 エグゼクティブサマリー

本レポートは、AI専門家エージェントによる未来予測分析の結果をまとめたものです。
複数の専門家の視点を統合し、${targetYears[0]}年を中心とした未来シナリオを分析しました。

---

`;

    phases.forEach((phase, index) => {
      markdown += `## Phase ${index + 1}: ${phase.title}\n\n`;
      markdown += `${phase.content}\n\n`;

      if (phase.analyses && phase.analyses.length > 0) {
        markdown += `### 専門家分析\n\n`;
        phase.analyses.forEach(analysis => {
          markdown += `#### ${analysis.expert}\n\n`;
          markdown += `${analysis.content}\n\n`;
          if (analysis.recommendations.length > 0) {
            markdown += `**推奨事項:**\n`;
            analysis.recommendations.forEach(rec => {
              markdown += `- ${rec}\n`;
            });
            markdown += `\n`;
          }
        });
      }

      if (phase.recommendations && phase.recommendations.length > 0) {
        markdown += `### 主要推奨事項\n\n`;
        phase.recommendations.forEach(rec => {
          markdown += `- ${rec}\n`;
        });
        markdown += `\n`;
      }

      markdown += `---\n\n`;
    });

    markdown += `## 🎯 総合提言

このレポートに基づき、以下の戦略的アプローチを推奨します：

1. **短期的施策（1-2年）:** 現在の戦略の強化と基盤整備
2. **中期的施策（3-5年）:** 新技術・新市場への適応準備
3. **長期的施策（5年以上）:** 持続可能な競争優位の構築

---

*このレポートは AI 専門家エージェントシステムにより生成されました。*
`;

    return markdown;
  }

  generateMarkdownReportMultiYear(
    theme: string,
    currentStrategy: string,
    targetYears: number[],
    yearResults: YearResult[]
  ): string {
    const date = new Date().toISOString().split('T')[0];
    
    let markdown = `# 未来予測AIシナリオ分析レポート（複数年予測）

**生成日:** ${date}
**分析テーマ:** ${theme}
**現在の経営戦略:** ${currentStrategy}
**予測年:** ${targetYears.join(', ')}

---

## 📋 エグゼクティブサマリー

本レポートは、AI専門家エージェントによる複数年にわたる未来予測分析の結果をまとめたものです。
${targetYears.map(year => `${year}年`).join('、')}における未来シナリオを、段階的に分析しています。

---

## 📊 年別分析結果インデックス

`;

    yearResults.forEach(yearResult => {
      markdown += `- [${yearResult.year}年の分析](#${yearResult.year}年の未来予測シナリオ)
`;
    });

    markdown += `
---

`;

    // Generate content for each year
    yearResults.forEach((yearResult, yearIndex) => {
      markdown += `## ${yearResult.year}年の未来予測シナリオ

`;
      
      yearResult.phases.forEach((phase, phaseIndex) => {
        markdown += `### Phase ${phaseIndex + 1}: ${phase.title}

`;
        markdown += `${phase.content}

`;

        if (phase.analyses && phase.analyses.length > 0) {
          markdown += `#### 専門家分析

`;
          phase.analyses.forEach(analysis => {
            markdown += `##### ${analysis.expert}

`;
            markdown += `${analysis.content}

`;
            if (analysis.recommendations.length > 0) {
              markdown += `**推奨事項:**
`;
              analysis.recommendations.forEach(rec => {
                markdown += `- ${rec}
`;
              });
              markdown += `
`;
            }
          });
        }

        if (phase.recommendations && phase.recommendations.length > 0) {
          markdown += `#### 主要推奨事項

`;
          phase.recommendations.forEach(rec => {
            markdown += `- ${rec}
`;
          });
          markdown += `
`;
        }
      });

      if (yearIndex < yearResults.length - 1) {
        markdown += `---

`;
      }
    });

    markdown += `---

## 🎯 複数年総合提言

この複数年分析に基づき、以下の段階的戦略アプローチを推奨します：

`;

    targetYears.forEach((year, index) => {
      const timeframe = index === 0 ? '短期的施策' : index === 1 ? '中期的施策' : '長期的施策';
      markdown += `${index + 1}. **${timeframe}（${year}年目標）:** 段階的な戦略展開と適応
`;
    });

    markdown += `
---

*このレポートは AI 専門家エージェントシステムにより生成されました。*
`;

    return markdown;
  }
}

export const openAIService = new OpenAIService();
