import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseMarkdownToHtml } from "@/lib/markdown-parser";
import ReasoningProcess from "./reasoning-process";

interface PhaseAnalysis {
  expert: string;
  content: string;
  recommendations?: string[];
  reasoningProcess?: import("@shared/schema").ExpertReasoningProcess;
}

interface Phase {
  phase: number;
  title: string;
  content: string;
  analyses?: PhaseAnalysis[];
  recommendations?: string[];
}

interface PhaseSectionProps {
  phase: Phase;
  phaseNumber: number;
}

const phaseColors = {
  1: "hsl(262, 83%, 58%)", // primary
  2: "hsl(160, 84%, 39%)", // secondary  
  3: "hsl(43, 96%, 56%)",  // accent
  4: "hsl(285, 100%, 67%)", // purple
  5: "hsl(200, 100%, 50%)", // blue
};

const phaseIcons = {
  1: "🧠",
  2: "📋", 
  3: "✨",
  4: "📊",
  5: "🎯",
};

export default function PhaseSection({ phase, phaseNumber }: PhaseSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const color = phaseColors[phaseNumber as keyof typeof phaseColors] || phaseColors[1];
  const icon = phaseIcons[phaseNumber as keyof typeof phaseIcons] || "📋";

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  // Parse strategic alignment if it's JSON
  let strategicAlignment = null;
  if (phaseNumber === 4 && typeof phase.content === "string") {
    try {
      strategicAlignment = JSON.parse(phase.content);
    } catch {
      // If it's not valid JSON, treat it as regular content
    }
  }

  return (
    <div 
      className={`phase-section phase-${phaseNumber} bg-white dark:bg-card rounded-xl p-6 shadow-sm border border-border`}
      style={{ borderLeftColor: color }}
      data-testid={`phase-section-${phaseNumber}`}
    >
      <div className="flex items-center space-x-3 mb-4">
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: color }}
        >
          {phaseNumber}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100" data-testid={`text-phase-title-${phaseNumber}`}>
          {icon} Phase{phaseNumber}: {phase.title}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          className="ml-auto border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          data-testid={`button-toggle-phase-${phaseNumber}`}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-800 dark:text-gray-200" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-800 dark:text-gray-200" />
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Phase content */}
          {phase.content && !strategicAlignment && (
            <div 
              className="markdown-content prose-sm max-w-none" 
              data-testid={`text-phase-content-${phaseNumber}`}
              dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(phase.content) }}
            />
          )}

          {/* Expert analyses for Phase 1 */}
          {phase.analyses && phase.analyses.length > 0 && (
            <div className="space-y-4">
              {phase.analyses.map((analysis, index) => (
                <div 
                  key={index}
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                  data-testid={`analysis-card-${phaseNumber}-${index}`}
                >
                  <h4 className="font-medium text-primary mb-2" data-testid={`text-expert-name-${phaseNumber}-${index}`}>
                    🧠 {analysis.expert}
                  </h4>
                  <div 
                    className="markdown-content prose-sm max-w-none" 
                    data-testid={`text-expert-analysis-${phaseNumber}-${index}`}
                    dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(analysis.content) }}
                  />
                  
                  {/* Show reasoning process if available */}
                  {analysis.reasoningProcess && (
                    <div className="mt-4">
                      <ReasoningProcess 
                        reasoningProcess={analysis.reasoningProcess} 
                        data-testid={`reasoning-process-${phaseNumber}-${index}`}
                      />
                    </div>
                  )}
                  
                  {analysis.recommendations && analysis.recommendations.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-xs font-medium text-primary mb-1">推奨事項:</h5>
                      <ul className="text-xs text-slate-800 dark:text-slate-100 space-y-1">
                        {analysis.recommendations.map((rec, recIndex) => (
                          <li key={recIndex} data-testid={`text-recommendation-${phaseNumber}-${index}-${recIndex}`}>
                            • {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Strategic alignment display for Phase 4 */}
          {strategicAlignment && (
            <div className="space-y-4">
              <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-4">
                現在の経営戦略の整合性評価結果：
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-medium text-green-700 dark:text-green-400 mb-2" data-testid={`text-strengths-title-${phaseNumber}`}>
                    強み・機会
                  </h4>
                  <ul className="text-sm text-green-600 dark:text-green-300 space-y-1">
                    {strategicAlignment.strengths?.map((strength: string, index: number) => (
                      <li key={index} data-testid={`text-strength-${phaseNumber}-${index}`}>• {strength}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-medium text-red-700 dark:text-red-400 mb-2" data-testid={`text-weaknesses-title-${phaseNumber}`}>
                    課題・リスク
                  </h4>
                  <ul className="text-sm text-red-600 dark:text-red-300 space-y-1">
                    {strategicAlignment.weaknesses?.map((weakness: string, index: number) => (
                      <li key={index} data-testid={`text-weakness-${phaseNumber}-${index}`}>• {weakness}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {strategicAlignment.recommendations && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2" data-testid={`text-strategic-recommendations-title-${phaseNumber}`}>
                    戦略的推奨事項
                  </h4>
                  <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
                    {strategicAlignment.recommendations.map((rec: string, index: number) => (
                      <li key={index} data-testid={`text-strategic-recommendation-${phaseNumber}-${index}`}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Phase recommendations */}
          {phase.recommendations && phase.recommendations.length > 0 && (
            <div 
              className="bg-secondary/5 border border-secondary/20 rounded-lg p-4"
              data-testid={`recommendations-section-${phaseNumber}`}
            >
              <h4 className="font-medium text-secondary mb-3">主要推奨事項</h4>
              <ul className="text-sm text-gray-900 dark:text-gray-100 space-y-1">
                {phase.recommendations.map((rec, index) => (
                  <li key={index} data-testid={`text-phase-recommendation-${phaseNumber}-${index}`}>
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
