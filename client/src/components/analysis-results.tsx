import PhaseSection from "@/components/phase-section";
import { Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Analysis, AnalysisResults, YearResult } from "@shared/schema";

interface AnalysisResultsProps {
  analysis: Analysis;
}

export default function AnalysisResults({ analysis }: AnalysisResultsProps) {
  const results = analysis.results as AnalysisResults;
  const yearResults = results?.years || [];
  const legacyPhases = results?.phases || []; // Backward compatibility

  // If no multi-year results, fall back to legacy single-year display
  if (!yearResults.length && !legacyPhases.length) {
    return null;
  }

  const displayYearResults = yearResults.length > 0;

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
            {displayYearResults && yearResults.length > 1 && (
              <span className="text-base font-normal text-gray-600 dark:text-gray-400 ml-2">
                （{yearResults.length}年分の予測）
              </span>
            )}
          </h2>
        </div>

        {displayYearResults ? (
          /* Multi-Year Results */
          <div className="space-y-12">
            {yearResults.map((yearResult: YearResult, yearIndex: number) => (
              <div key={yearResult.year} className="space-y-6">
                {/* Year Header */}
                <div className="flex items-center space-x-3 py-4 border-b-2 border-primary/20">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100" data-testid={`text-year-${yearResult.year}`}>
                      {yearResult.year}年の未来予測シナリオ
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Phase 1〜5の分析結果
                    </p>
                  </div>
                </div>

                {/* Year Phases */}
                <div className="space-y-6 pl-6">
                  {yearResult.phases.map((phase: any, index: number) => (
                    <PhaseSection
                      key={`${yearResult.year}-${phase.phase || index}`}
                      phase={phase}
                      phaseNumber={phase.phase || index + 1}
                    />
                  ))}
                </div>

                {yearIndex < yearResults.length - 1 && (
                  <div className="py-8">
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Legacy Single-Year Display */
          <div className="space-y-6">
            {legacyPhases.map((phase: any, index: number) => (
              <PhaseSection
                key={phase.phase || index}
                phase={phase}
                phaseNumber={phase.phase || index + 1}
              />
            ))}
          </div>
        )}

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
