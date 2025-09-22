import { useState } from "react";
import { ChevronRight, ChevronDown, Brain, Target, CheckCircle, Clock, BookOpen, Database, BarChart3, FileText, Shield, AlertTriangle, TrendingUp, ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ExpertReasoningProcess, ReasoningStep, EvidenceSupport, DataSource, StatisticalEvidence, ResearchPaper } from "@shared/schema";

interface ReasoningProcessProps {
  reasoningProcess: ExpertReasoningProcess;
  className?: string;
}

// Evidence Display Component
interface EvidenceDisplayProps {
  evidenceSupport: EvidenceSupport;
  stepNumber: number;
}

function EvidenceDisplay({ evidenceSupport, stepNumber }: EvidenceDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSourceTypeIcon = (type: DataSource['type']) => {
    switch (type) {
      case 'government': return <Shield className="h-3 w-3 text-blue-500" />;
      case 'academic': return <FileText className="h-3 w-3 text-purple-500" />;
      case 'research': return <FileText className="h-3 w-3 text-green-500" />;
      case 'industry': return <BarChart3 className="h-3 w-3 text-orange-500" />;
      case 'survey': return <Database className="h-3 w-3 text-cyan-500" />;
      case 'report': return <BookOpen className="h-3 w-3 text-indigo-500" />;
      case 'database': return <Database className="h-3 w-3 text-gray-500" />;
      default: return <FileText className="h-3 w-3 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: StatisticalEvidence['trend']) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'decreasing': return <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />;
      case 'stable': return <div className="h-3 w-3 border-b-2 border-blue-500" />;
      case 'volatile': return <div className="h-3 w-3 border border-yellow-500 rounded-sm" />;
      default: return <div className="h-3 w-3 border-b-2 border-gray-500" />;
    }
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-3 w-3 ${i < rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
      />
    ));
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 mt-3 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-medium text-gray-900 dark:text-white">詳細な根拠情報</span>
          <Badge variant="outline" className="text-xs">
            信頼度 {evidenceSupport.quality.overallRating}/5
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 h-6 w-6"
          data-testid={`button-toggle-evidence-${stepNumber}`}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {/* Summary Statement */}
          <div>
            <p className="text-xs text-gray-800 dark:text-gray-200 font-medium">
              {evidenceSupport.summaryStatement}
            </p>
          </div>

          <Separator className="my-3" />

          {/* Data Sources */}
          {evidenceSupport.dataSources.length > 0 && (
            <div>
              <div className="flex items-center space-x-1 mb-2">
                <Database className="h-3 w-3 text-blue-500" />
                <span className="text-xs font-medium text-gray-900 dark:text-white">データソース</span>
              </div>
              <div className="space-y-2">
                {evidenceSupport.dataSources.map((source, index) => (
                  <div key={index} className="flex items-start space-x-2 text-xs" data-testid={`data-source-${stepNumber}-${index}`}>
                    {getSourceTypeIcon(source.type)}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{source.name}</div>
                      {source.organization && (
                        <div className="text-gray-600 dark:text-gray-400">{source.organization}</div>
                      )}
                      {source.datePublished && (
                        <div className="text-gray-500 dark:text-gray-500">{source.datePublished}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      {getRatingStars(source.credibilityRating)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statistical Evidence */}
          {evidenceSupport.statisticalEvidence.length > 0 && (
            <div>
              <div className="flex items-center space-x-1 mb-2">
                <BarChart3 className="h-3 w-3 text-green-500" />
                <span className="text-xs font-medium text-gray-900 dark:text-white">統計データ</span>
              </div>
              <div className="space-y-2">
                {evidenceSupport.statisticalEvidence.map((stat, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded p-2 text-xs" data-testid={`statistical-evidence-${stepNumber}-${index}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900 dark:text-white">{stat.metric}</div>
                      <div className="flex items-center space-x-1">
                        {getTrendIcon(stat.trend)}
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {stat.value} {stat.unit && `(${stat.unit})`}
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      期間: {stat.timeframe} | 出典: {stat.source}
                      {stat.confidenceLevel && ` | 信頼度: ${stat.confidenceLevel}%`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research Papers */}
          {evidenceSupport.researchPapers.length > 0 && (
            <div>
              <div className="flex items-center space-x-1 mb-2">
                <FileText className="h-3 w-3 text-purple-500" />
                <span className="text-xs font-medium text-gray-900 dark:text-white">研究論文</span>
              </div>
              <div className="space-y-2">
                {evidenceSupport.researchPapers.map((paper, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded p-2 text-xs" data-testid={`research-paper-${stepNumber}-${index}`}>
                    <div className="font-medium text-gray-900 dark:text-white">{paper.title}</div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      著者: {paper.authors.join(', ')} ({paper.year})
                      {paper.journal && ` | ${paper.journal}`}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center space-x-1">
                        {getRatingStars(paper.relevanceScore)}
                      </div>
                      {paper.doi && (
                        <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
                          <ExternalLink className="h-3 w-3" />
                          <span>DOI</span>
                        </div>
                      )}
                    </div>
                    {paper.keyFindings.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium text-gray-700 dark:text-gray-300">主要な発見:</div>
                        <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 ml-2">
                          {paper.keyFindings.map((finding, findingIndex) => (
                            <li key={findingIndex}>{finding}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quality Assessment */}
          <div>
            <div className="flex items-center space-x-1 mb-2">
              <Shield className="h-3 w-3 text-orange-500" />
              <span className="text-xs font-medium text-gray-900 dark:text-white">品質評価</span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-2 text-xs">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">総合評価:</span>
                  <div className="flex items-center space-x-1">
                    {getRatingStars(evidenceSupport.quality.overallRating)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">データ新しさ:</span>
                  <div className="flex items-center space-x-1">
                    {getRatingStars(evidenceSupport.quality.dataRecency)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">情報源信頼性:</span>
                  <div className="flex items-center space-x-1">
                    {getRatingStars(evidenceSupport.quality.sourceReliability)}
                  </div>
                </div>
                {evidenceSupport.quality.sampleSize && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">サンプル規模:</span>
                    <span className="text-gray-900 dark:text-white">{evidenceSupport.quality.sampleSize}</span>
                  </div>
                )}
              </div>

              {evidenceSupport.quality.strengths.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center space-x-1 mb-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="font-medium text-green-700 dark:text-green-400">強み:</span>
                  </div>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 ml-3">
                    {evidenceSupport.quality.strengths.map((strength, index) => (
                      <li key={index}>{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evidenceSupport.quality.limitations.length > 0 && (
                <div>
                  <div className="flex items-center space-x-1 mb-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    <span className="font-medium text-yellow-700 dark:text-yellow-400">制限事項:</span>
                  </div>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 ml-3">
                    {evidenceSupport.quality.limitations.map((limitation, index) => (
                      <li key={index}>{limitation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
                <div key={step.id} className="rounded-lg overflow-hidden">
                  <Button
                    variant="ghost"
                    onClick={() => toggleStep(step.id)}
                    className="w-full justify-between p-3 h-auto text-left font-normal hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    data-testid={`button-toggle-step-${step.stepNumber}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        {step.stepNumber}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-white" data-testid={`step-title-${step.stepNumber}`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-200 mt-1" data-testid={`step-description-${step.stepNumber}`}>
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
                      <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    )}
                  </Button>

                  {expandedSteps.has(step.id) && (
                    <div className="px-3 pb-3" data-testid={`step-details-${step.stepNumber}`}>
                      <div className="pt-3 space-y-3">
                        <div>
                          <div className="flex items-center space-x-1 mb-2">
                            <Target className="h-3 w-3 text-blue-500" />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">推論過程</span>
                          </div>
                          <p className="text-xs text-gray-900 dark:text-white leading-relaxed" data-testid={`step-reasoning-${step.stepNumber}`}>
                            {step.reasoning}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center space-x-1 mb-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">結論</span>
                          </div>
                          <p className="text-xs text-gray-900 dark:text-white leading-relaxed" data-testid={`step-conclusion-${step.stepNumber}`}>
                            {step.conclusion}
                          </p>
                        </div>

                        {step.sources && step.sources.length > 0 && (
                          <div>
                            <div className="flex items-center space-x-1 mb-2">
                              <BookOpen className="h-3 w-3 text-purple-500" />
                              <span className="text-xs font-medium text-gray-900 dark:text-white">参考情報</span>
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

                        {step.evidenceSupport && (
                          <EvidenceDisplay evidenceSupport={step.evidenceSupport} stepNumber={step.stepNumber} />
                        )}

                        <div className="flex items-center space-x-1 text-xs text-gray-700 dark:text-gray-300">
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