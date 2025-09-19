import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Settings, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ScenarioConfigProps {
  onAnalysisStart: (analysisId: string) => void;
}

export default function ScenarioConfig({ onAnalysisStart }: ScenarioConfigProps) {
  const [theme, setTheme] = useState("");
  const [currentStrategy, setCurrentStrategy] = useState("");
  const [targetYears, setTargetYears] = useState("");
  const [agentCount, setAgentCount] = useState("3");
  const [episodeCount, setEpisodeCount] = useState("20");
  const { toast } = useToast();

  const startAnalysisMutation = useMutation({
    mutationFn: async () => {
      // First create scenario
      const scenarioResponse = await apiRequest("POST", "/api/scenarios", {
        theme,
        currentStrategy,
        targetYears: targetYears.split(',').map(year => parseInt(year.trim())),
        agentCount,
        episodeCount,
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

    const years = targetYears.split(',').map(year => year.trim());
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
          <label className="text-sm font-medium text-foreground">未来年（カンマ区切り）</label>
          <Input
            value={targetYears}
            onChange={(e) => setTargetYears(e.target.value)}
            placeholder="2030,2040,2050"
            data-testid="input-years"
          />
        </div>

        {/* Agent and Episode Count */}
        <div className="flex space-x-4">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-foreground">エージェント数</label>
            <Select value={agentCount} onValueChange={setAgentCount}>
              <SelectTrigger data-testid="select-agent-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-foreground">エピソード数</label>
            <Select value={episodeCount} onValueChange={setEpisodeCount}>
              <SelectTrigger data-testid="select-episode-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
              </SelectContent>
            </Select>
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
