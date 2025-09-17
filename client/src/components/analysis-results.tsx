import PhaseSection from "@/components/phase-section";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Analysis } from "@shared/schema";

interface AnalysisResultsProps {
  analysis: Analysis;
}

export default function AnalysisResults({ analysis }: AnalysisResultsProps) {
  const results = analysis.results as any;
  const phases = results?.phases || [];

  if (!phases.length) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Main Analysis Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">AI</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-analysis-results-title">
            未来予測分析結果
          </h2>
        </div>

        {/* Phase Results */}
        {phases.map((phase: any, index: number) => (
          <PhaseSection
            key={phase.phase || index}
            phase={phase}
            phaseNumber={phase.phase || index + 1}
          />
        ))}

        {/* Download Section */}
        {analysis.status === "completed" && analysis.markdownReport && (
          <div className="bg-white dark:bg-card rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2" data-testid="text-download-title">📋 レポート生成完了</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="text-download-description">
                  分析結果をマークダウン形式でダウンロードできます
                </p>
              </div>
              <Button
                className="flex items-center space-x-2"
                onClick={() => {
                  window.location.href = `/api/analysis/${analysis.id}/download`;
                }}
                data-testid="button-download-markdown"
              >
                <Download className="h-4 w-4" />
                <span>MDファイルダウンロード</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
