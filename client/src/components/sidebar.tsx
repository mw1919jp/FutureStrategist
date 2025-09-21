import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import ExpertConfig from "@/components/expert-config";
import ScenarioConfig from "@/components/scenario-config";
import ModelConfig from "@/components/model-config";
import { Brain, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_LLM_MODEL, type LLMModel } from "@shared/schema";

interface SidebarProps {
  onAnalysisStart: (analysisId: string) => void;
}

export default function Sidebar({ onAnalysisStart }: SidebarProps) {
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_LLM_MODEL);
  const [theme, setTheme] = useState("");
  const [currentStrategy, setCurrentStrategy] = useState("");
  const [targetYears, setTargetYears] = useState("");
  const [characterCount, setCharacterCount] = useState([1000]);
  const { toast } = useToast();

  const startAnalysisMutation = useMutation({
    mutationFn: async () => {
      // First create scenario
      const scenarioResponse = await apiRequest("POST", "/api/scenarios", {
        theme,
        currentStrategy,
        targetYears: targetYears.split(',').map(year => year.trim()).filter(year => year !== '').map(year => parseInt(year)),
        characterCount: characterCount[0].toString(),
        model: selectedModel,
      });
      
      const scenario = await scenarioResponse.json();
      
      // Then start analysis
      const analysisResponse = await apiRequest("POST", "/api/analysis/start", {
        scenarioId: scenario.id,
      });
      
      return analysisResponse.json();
    },
    onSuccess: (data) => {
      onAnalysisStart(data.analysisId);
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "分析の開始に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleStartAnalysis = () => {
    if (!theme.trim() || !currentStrategy.trim()) {
      toast({
        title: "入力エラー",
        description: "テーマと現在の戦略を入力してください。",
        variant: "destructive",
      });
      return;
    }

    if (!targetYears.trim()) {
      toast({
        title: "入力エラー",
        description: "未来年を入力してください（例：2030,2040,2050）。",
        variant: "destructive",
      });
      return;
    }

    const years = targetYears.split(',').map(year => year.trim()).filter(year => year !== '');
    if (years.length === 0) {
      toast({
        title: "入力エラー",
        description: "未来年を入力してください（例：2030,2040,2050）。",
        variant: "destructive",
      });
      return;
    }

    if (years.some(year => isNaN(Number(year)))) {
      toast({
        title: "入力エラー",
        description: "有効な年数を入力してください（例：2030,2040,2050）。",
        variant: "destructive",
      });
      return;
    }

    startAnalysisMutation.mutate();
  };

  return (
    <aside className="w-80 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      {/* Logo and Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground" data-testid="text-logo-title">FUTURE</h1>
            <p className="text-sm font-medium text-muted-foreground" data-testid="text-logo-subtitle">SCENARIO LAB</p>
          </div>
        </div>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-8">
        <ExpertConfig />
        <ScenarioConfig 
          theme={theme}
          setTheme={setTheme}
          currentStrategy={currentStrategy}
          setCurrentStrategy={setCurrentStrategy}
          targetYears={targetYears}
          setTargetYears={setTargetYears}
          characterCount={characterCount}
          setCharacterCount={setCharacterCount}
        />
        <ModelConfig 
          selectedModel={selectedModel} 
          onModelChange={setSelectedModel} 
        />
        
        {/* Analysis Start Button */}
        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleStartAnalysis}
          disabled={startAnalysisMutation.isPending}
          data-testid="button-start-analysis"
        >
          <Play className="h-4 w-4 mr-2" />
          {startAnalysisMutation.isPending ? "分析開始中..." : "分析開始"}
        </Button>
      </div>
    </aside>
  );
}
