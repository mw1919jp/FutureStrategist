import { useState, useEffect, useRef } from "react";
import { BarChart3, Terminal, Clock, User, Calendar, Lightbulb, CheckCircle } from "lucide-react";
import type { Analysis, PartialExpertAnalysis, PartialYearScenario, PartialPhaseResult } from "@shared/schema";
import { parseMarkdownToHtml } from "@/lib/markdown-parser";
import ReasoningProcess from "./reasoning-process";

interface AnalysisLog {
  timestamp: string;
  analysisId: string;
  phase: number;
  action: 'api_request' | 'api_response' | 'phase_start' | 'phase_complete' | 'error';
  message: string;
  data?: any;
}

interface PartialResults {
  expertAnalyses: PartialExpertAnalysis[];
  yearScenarios: PartialYearScenario[];
  phaseResults: PartialPhaseResult[];
}

interface AnalysisProgressProps {
  analysis: Analysis;
}

export default function AnalysisProgress({ analysis }: AnalysisProgressProps) {
  const progress = parseInt(analysis.progress);
  const isCompleted = analysis.status === "completed";
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [partialResults, setPartialResults] = useState<PartialResults>({
    expertAnalyses: [],
    yearScenarios: [],
    phaseResults: []
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  // SSE connection for real-time logs
  useEffect(() => {
    if (analysis.status === "running" && !isCompleted) {
      const eventSource = new EventSource(`/api/analysis/${analysis.id}/events`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'analysis_log') {
            setLogs(prevLogs => [...prevLogs, data.data]);
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      // Add event listeners for partial results
      eventSource.addEventListener('partial_expert_analysis', (event) => {
        try {
          const expertAnalysis = JSON.parse(event.data) as PartialExpertAnalysis;
          setPartialResults(prev => ({
            ...prev,
            expertAnalyses: [...prev.expertAnalyses, expertAnalysis]
          }));
        } catch (error) {
          console.error('Error parsing partial expert analysis:', error);
        }
      });

      eventSource.addEventListener('partial_year_scenario', (event) => {
        try {
          const yearScenario = JSON.parse(event.data) as PartialYearScenario;
          setPartialResults(prev => ({
            ...prev,
            yearScenarios: [...prev.yearScenarios, yearScenario]
          }));
        } catch (error) {
          console.error('Error parsing partial year scenario:', error);
        }
      });

      eventSource.addEventListener('partial_phase_result', (event) => {
        try {
          const phaseResult = JSON.parse(event.data) as PartialPhaseResult;
          setPartialResults(prev => ({
            ...prev,
            phaseResults: [...prev.phaseResults, phaseResult]
          }));
        } catch (error) {
          console.error('Error parsing partial phase result:', error);
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
      };

      return () => {
        eventSource.close();
        setIsConnected(false);
      };
    }
  }, [analysis.id, analysis.status, isCompleted]);

  const phases = [
    { id: "1", name: "情報収集とシミュレーション", threshold: 20 },
    { id: "2", name: "シナリオ生成", threshold: 40 },
    { id: "3", name: "長期視点分析", threshold: 60 },
    { id: "4", name: "戦略整合性評価", threshold: 80 },
    { id: "5", name: "最終統合分析", threshold: 100 },
  ];

  return (
    <div className="bg-white dark:bg-card border-b border-border p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <div className="flex items-center space-x-3 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100" data-testid="text-analysis-title">📊 分析進捗状況</h2>
          </div>
          
          {analysis.results && typeof analysis.results === 'object' && 'phases' in analysis.results && Array.isArray((analysis.results as any).phases) && (analysis.results as any).phases?.[0]?.analyses && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-600 dark:text-gray-400">分析ID:</span>
                <span className="text-gray-900 dark:text-gray-100 ml-2" data-testid={`text-analysis-id`}>
                  {analysis.id.slice(0, 8)}...
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">現在のフェーズ:</span>
                <span className="text-gray-900 dark:text-gray-100 ml-2" data-testid={`text-current-phase`}>
                  Phase {analysis.currentPhase}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">ステータス:</span>
                <span className="text-gray-900 dark:text-gray-100 ml-2" data-testid={`text-status`}>
                  {analysis.status === "running" ? "実行中" : 
                   analysis.status === "completed" ? "完了" : 
                   analysis.status === "failed" ? "失敗" : "待機中"}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">進捗:</span>
                <span className="text-gray-900 dark:text-gray-100 ml-2" data-testid={`text-progress`}>
                  {analysis.progress}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicators */}
        <div className="space-y-3">
          {phases.map((phase) => {
            const isActive = parseInt(analysis.currentPhase) >= parseInt(phase.id);
            const isComplete = progress >= phase.threshold;
            const isCurrent = parseInt(analysis.currentPhase) === parseInt(phase.id) && !isCompleted;

            return (
              <div key={phase.id} className="flex items-center space-x-3" data-testid={`phase-indicator-${phase.id}`}>
                <div 
                  className={`w-3 h-3 rounded-full ${
                    isComplete 
                      ? "bg-secondary" 
                      : isCurrent 
                        ? "bg-secondary animate-pulse" 
                        : "bg-gray-200 dark:bg-gray-700"
                  }`} 
                />
                <span className={`text-sm ${isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"}`}>
                  {phase.name}
                  {isCurrent && !isCompleted && "..."}
                </span>
                <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div 
                    className={`h-1 rounded-full transition-all duration-300 ${
                      isCurrent && !isCompleted 
                        ? "bg-secondary animate-pulse" 
                        : "bg-secondary"
                    }`}
                    style={{ 
                      width: `${Math.min(100, Math.max(0, 
                        isComplete ? 100 : 
                        isCurrent ? Math.max(20, (progress - (phase.threshold - 20)) * 5) : 
                        0
                      ))}%` 
                    }}
                  />
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400" data-testid={`text-phase-status-${phase.id}`}>
                  {isComplete ? "完了" : isCurrent ? `${progress}%` : "待機中"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Partial Results Display */}
        {analysis.status === "running" && (partialResults.expertAnalyses.length > 0 || partialResults.yearScenarios.length > 0 || partialResults.phaseResults.length > 0) && (
          <div className="mt-6 border-t border-border pt-6">
            <div className="flex items-center space-x-3 mb-4">
              <Lightbulb className="h-5 w-5 text-secondary" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">リアルタイム分析結果</h3>
              <div className="text-xs text-secondary bg-secondary/10 px-2 py-1 rounded">
                {partialResults.expertAnalyses.length + partialResults.yearScenarios.length + partialResults.phaseResults.length} 件完了
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Expert Analyses */}
              {partialResults.expertAnalyses.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <User className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">専門家分析完了 ({partialResults.expertAnalyses.length}件)</h4>
                  </div>
                  <div className="grid gap-3">
                    {partialResults.expertAnalyses.slice(-3).map((analysis, index) => (
                      <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-blue-100 dark:border-blue-900 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-blue-900 dark:text-blue-100">{analysis.expert}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">({analysis.year}年)</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(analysis.completedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        
                        {/* Content Preview */}
                        <div className="text-sm space-y-2">
                          <div 
                            className="markdown-content prose-sm max-w-none text-gray-900 dark:text-gray-100 leading-relaxed"
                            dangerouslySetInnerHTML={{ 
                              __html: parseMarkdownToHtml(
                                analysis.content.length > 200 
                                  ? `${analysis.content.substring(0, 200)}...` 
                                  : analysis.content
                              ) 
                            }}
                          />
                          
                          {/* Show reasoning process if available */}
                          {analysis.reasoningProcess && (
                            <div className="mt-4">
                              <ReasoningProcess 
                                reasoningProcess={analysis.reasoningProcess} 
                                data-testid={`analysis-card-${index}-reasoning`}
                              />
                            </div>
                          )}
                          
                          {analysis.recommendations && analysis.recommendations.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">主要な推奨事項:</div>
                              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 ml-3">
                                {analysis.recommendations.slice(0, 3).map((rec, recIndex) => (
                                  <li key={recIndex} className="flex items-start space-x-1">
                                    <span className="text-blue-600 mt-1">•</span>
                                    <span className="leading-relaxed">
                                      {rec.length > 80 ? `${rec.substring(0, 80)}...` : rec}
                                    </span>
                                  </li>
                                ))}
                                {analysis.recommendations.length > 3 && (
                                  <li className="text-xs text-blue-600 dark:text-blue-400 italic">
                                    他 {analysis.recommendations.length - 3} 項目...
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Year Scenarios */}
              {partialResults.yearScenarios.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <h4 className="text-sm font-medium text-green-900 dark:text-green-100">年別シナリオ完了 ({partialResults.yearScenarios.length}件)</h4>
                  </div>
                  <div className="grid gap-3">
                    {partialResults.yearScenarios.map((scenario, index) => (
                      <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-green-100 dark:border-green-900 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-900 dark:text-green-100">{scenario.year}年シナリオ</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">({Math.round(scenario.content.length / 1000)}k文字)</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(scenario.completedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        
                        {/* Content Preview */}
                        <div className="text-sm space-y-2">
                          <div 
                            className="markdown-content prose-sm max-w-none text-gray-900 dark:text-gray-100 leading-relaxed"
                            dangerouslySetInnerHTML={{ 
                              __html: parseMarkdownToHtml(
                                scenario.content.length > 300 
                                  ? `${scenario.content.substring(0, 300)}...` 
                                  : scenario.content
                              ) 
                            }}
                          />
                          <div className="text-xs text-blue-600 dark:text-blue-400 italic">
                            完全な内容は分析完了後にご覧いただけます
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Real-time Analysis Logs */}
        {analysis.status === "running" && (
          <div className="mt-6 border-t border-border pt-6">
            <div className="flex items-center space-x-3 mb-4">
              <Terminal className="h-5 w-5 text-secondary" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">リアルタイム実行ログ</h3>
              {isConnected && (
                <div className="flex items-center space-x-1 text-xs text-secondary">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span>接続中</span>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900 border border-border rounded-lg p-4 max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>実行ログを待機中...</span>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`flex items-start space-x-2 p-2 rounded ${
                        log.action === 'error' 
                          ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                          : log.action === 'phase_start' 
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : log.action === 'phase_complete'
                          ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                          : log.action === 'api_request'
                          ? 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                          : 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'
                      }`}
                      data-testid={`log-entry-${index}`}
                    >
                      <div className="flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">Phase {log.phase}: {log.message}</div>
                        {log.data && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {log.data.endpoint && (
                              <span>エンドポイント: {log.data.endpoint} | </span>
                            )}
                            {log.data.responseLength && (
                              <span>レスポンス: {log.data.responseLength}文字</span>
                            )}
                            {log.data.error && (
                              <span className="text-red-600 dark:text-red-400">エラー: {log.data.error}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
