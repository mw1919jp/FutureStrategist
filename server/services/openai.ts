import OpenAI from "openai";
import { logApiRequest, logApiResponse } from "../utils/logger";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

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

export class OpenAIService {
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
}

export const openAIService = new OpenAIService();
