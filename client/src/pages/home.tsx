import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import AnalysisProgress from "@/components/analysis-progress";
import AnalysisResults from "@/components/analysis-results";
import { Play, Square, Download, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Analysis } from "@shared/schema";

export default function Home() {
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: currentAnalysis, refetch } = useQuery<Analysis>({
    queryKey: ["/api/analysis", currentAnalysisId],
    enabled: !!currentAnalysisId,
    refetchInterval: currentAnalysisId ? 2000 : false,
  });

  const handleAnalysisStart = (analysisId: string) => {
    setCurrentAnalysisId(analysisId);
    toast({
      title: "分析開始",
      description: "AI専門家による未来予測分析を開始しました。",
    });
  };

  const handleStopAnalysis = () => {
    setCurrentAnalysisId(null);
    toast({
      title: "分析停止",
      description: "分析を停止しました。",
    });
  };

  const handleDownloadReport = async () => {
    if (!currentAnalysisId) return;

    try {
      const response = await fetch(`/api/analysis/${currentAnalysisId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `future-scenario-analysis-${currentAnalysisId}.md`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "ダウンロード完了",
          description: "レポートをダウンロードしました。",
        });
      } else {
        throw new Error("Download failed");
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "レポートのダウンロードに失敗しました。",
        variant: "destructive",
      });
    }
  };

  const isRunning = currentAnalysis?.status === "running";
  const isCompleted = currentAnalysis?.status === "completed";

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar onAnalysisStart={handleAnalysisStart} />
      
      <main className="flex-1 bg-gray-50 dark:bg-gray-900/20 flex flex-col">
        {/* Header Bar */}
        <header className="bg-white dark:bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-foreground" data-testid="page-title">
              未来予測AI シナリオシミュレーション
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {isRunning && (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" data-testid="status-indicator"></div>
                <span className="text-secondary font-medium" data-testid="status-text">RUNNING...</span>
              </div>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleStopAnalysis}
              disabled={!isRunning}
              data-testid="button-stop"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
            
            <Button 
              size="sm"
              onClick={handleDownloadReport}
              disabled={!isCompleted}
              data-testid="button-download"
            >
              <Download className="h-4 w-4 mr-2" />
              Deploy
            </Button>
            
            <Button variant="ghost" size="sm" data-testid="button-menu">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {currentAnalysis && (
            <>
              <AnalysisProgress analysis={currentAnalysis} />
              {currentAnalysis.results && (
                <AnalysisResults analysis={currentAnalysis} />
              )}
            </>
          )}
          
          {!currentAnalysisId && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Play className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground" data-testid="text-welcome">
                  未来予測分析の開始
                </h2>
                <p className="text-muted-foreground max-w-md" data-testid="text-instructions">
                  左側のパネルで専門家とシナリオ条件を設定し、「分析開始」ボタンをクリックしてください。
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
