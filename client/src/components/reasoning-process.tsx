import { useState } from "react";
import { ChevronRight, ChevronDown, Brain, Target, CheckCircle, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ExpertReasoningProcess, ReasoningStep } from "@shared/schema";

interface ReasoningProcessProps {
  reasoningProcess: ExpertReasoningProcess;
  className?: string;
}

export default function ReasoningProcess({ reasoningProcess, className = "" }: ReasoningProcessProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 dark:text-green-400";
    if (confidence >= 60) return "text-yellow-600 dark:text-yellow-400"; 
    return "text-red-600 dark:text-red-400";
  };

  const getConfidenceBadgeVariant = (confidence: number): "default" | "secondary" | "destructive" => {
    if (confidence >= 80) return "default";
    if (confidence >= 60) return "secondary";
    return "destructive";
  };

  return (
    <Card className={`reasoning-process ${className}`} data-testid="reasoning-process-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100" data-testid="reasoning-title">
              推論プロセス
            </h4>
            <Badge 
              variant={getConfidenceBadgeVariant(reasoningProcess.overallConfidence)}
              className="text-xs"
              data-testid="overall-confidence-badge"
            >
              信頼度 {reasoningProcess.overallConfidence}%
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 h-6 w-6"
            data-testid="button-toggle-reasoning"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="space-y-3">
            {/* Reasoning Steps */}
            <div className="space-y-2">
              {reasoningProcess.steps.map((step, index) => (
                <div key={step.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <Button
                    variant="ghost"
                    onClick={() => toggleStep(step.id)}
                    className="w-full justify-between p-3 h-auto text-left font-normal"
                    data-testid={`button-toggle-step-${step.stepNumber}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        {step.stepNumber}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100" data-testid={`step-title-${step.stepNumber}`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1" data-testid={`step-description-${step.stepNumber}`}>
                          {step.description}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={getConfidenceBadgeVariant(step.confidence)}
                          className="text-xs"
                          data-testid={`step-confidence-${step.stepNumber}`}
                        >
                          {step.confidence}%
                        </Badge>
                      </div>
                    </div>
                    {expandedSteps.has(step.id) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>

                  {expandedSteps.has(step.id) && (
                    <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800" data-testid={`step-details-${step.stepNumber}`}>
                      <div className="pt-3 space-y-3">
                        <div>
                          <div className="flex items-center space-x-1 mb-2">
                            <Target className="h-3 w-3 text-blue-500" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">推論過程</span>
                          </div>
                          <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed" data-testid={`step-reasoning-${step.stepNumber}`}>
                            {step.reasoning}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center space-x-1 mb-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">結論</span>
                          </div>
                          <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed" data-testid={`step-conclusion-${step.stepNumber}`}>
                            {step.conclusion}
                          </p>
                        </div>

                        {step.sources && step.sources.length > 0 && (
                          <div>
                            <div className="flex items-center space-x-1 mb-2">
                              <BookOpen className="h-3 w-3 text-purple-500" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">参考情報</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {step.sources.map((source, sourceIndex) => (
                                <Badge key={sourceIndex} variant="outline" className="text-xs" data-testid={`step-source-${step.stepNumber}-${sourceIndex}`}>
                                  {source}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Final Conclusion */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h5 className="font-medium text-sm text-blue-800 dark:text-blue-300" data-testid="final-conclusion-title">
                  最終結論
                </h5>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed" data-testid="final-conclusion-content">
                {reasoningProcess.finalConclusion}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}