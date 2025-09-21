import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Settings, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ScenarioConfigProps {
  onAnalysisStart: (analysisId: string) => void;
}

export default function ScenarioConfig({ onAnalysisStart }: ScenarioConfigProps) {
  const [theme, setTheme] = useState("");
  const [currentStrategy, setCurrentStrategy] = useState("");
  const [targetYears, setTargetYears] = useState("");
  const [characterCount, setCharacterCount] = useState([1000]); // slider uses array format
  const { toast } = useToast();

  const startAnalysisMutation = useMutation({
    mutationFn: async () => {
      // First create scenario
      const scenarioResponse = await apiRequest("POST", "/api/scenarios", {
        theme,
        currentStrategy,
        targetYears: targetYears.split(',').map(year => year.trim()).filter(year => year !== '').map(year => parseInt(year)),
        characterCount: characterCount[0].toString(),
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
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Settings className="h-4 w-4 text-secondary" />
        <h2 className="text-base font-semibold text-foreground" data-testid="text-scenario-config-title">シナリオ条件入力</h2>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Theme Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">未来テーマ</label>
          <Textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="AI技術活用による市場開拓"
            className="resize-none"
            rows={3}
            data-testid="input-theme"
          />
        </div>

        {/* Current Strategy */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">現在の経営戦略</label>
          <Textarea
            value={currentStrategy}
            onChange={(e) => setCurrentStrategy(e.target.value)}
            placeholder="DXを主導した顧客満足度向上とパーソナライゼーション"
            className="resize-none"
            rows={3}
            data-testid="input-strategy"
          />
        </div>

        {/* Year Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            未来年（カンマ区切り）<span className="text-red-500 ml-1">*</span>
          </label>
          <Input
            value={targetYears}
            onChange={(e) => setTargetYears(e.target.value)}
            placeholder="2030,2040,2050"
            data-testid="input-years"
          />
        </div>

        {/* Character Count Slider */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            調査結果の文字数: {characterCount[0]}文字
          </label>
          <Slider
            value={characterCount}
            onValueChange={setCharacterCount}
            min={500}
            max={2500}
            step={100}
            className="w-full"
            data-testid="slider-character-count"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>500文字</span>
            <span>2500文字</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
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
  );
}
