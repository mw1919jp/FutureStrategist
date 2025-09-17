import { BarChart3 } from "lucide-react";
import type { Analysis } from "@shared/schema";

interface AnalysisProgressProps {
  analysis: Analysis;
}

export default function AnalysisProgress({ analysis }: AnalysisProgressProps) {
  const progress = parseInt(analysis.progress);
  const isCompleted = analysis.status === "completed";

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
            <h2 className="text-lg font-semibold text-foreground" data-testid="text-analysis-title">📊 分析進捗状況</h2>
          </div>
          
          {analysis.results && typeof analysis.results === 'object' && 'phases' in analysis.results && Array.isArray((analysis.results as any).phases) && (analysis.results as any).phases?.[0]?.analyses && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-muted-foreground">分析ID:</span>
                <span className="text-foreground ml-2" data-testid={`text-analysis-id`}>
                  {analysis.id.slice(0, 8)}...
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">現在のフェーズ:</span>
                <span className="text-foreground ml-2" data-testid={`text-current-phase`}>
                  Phase {analysis.currentPhase}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">ステータス:</span>
                <span className="text-foreground ml-2" data-testid={`text-status`}>
                  {analysis.status === "running" ? "実行中" : 
                   analysis.status === "completed" ? "完了" : 
                   analysis.status === "failed" ? "失敗" : "待機中"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">進捗:</span>
                <span className="text-foreground ml-2" data-testid={`text-progress`}>
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
                <span className={`text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
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
                <span className="text-xs text-muted-foreground" data-testid={`text-phase-status-${phase.id}`}>
                  {isComplete ? "完了" : isCurrent ? `${progress}%` : "待機中"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
