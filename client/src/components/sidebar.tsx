import { useState } from "react";
import ExpertConfig from "@/components/expert-config";
import ScenarioConfig from "@/components/scenario-config";
import ModelConfig from "@/components/model-config";
import { Brain } from "lucide-react";
import { DEFAULT_LLM_MODEL, type LLMModel } from "@shared/schema";

interface SidebarProps {
  onAnalysisStart: (analysisId: string) => void;
}

export default function Sidebar({ onAnalysisStart }: SidebarProps) {
  const [selectedModel, setSelectedModel] = useState<LLMModel>(DEFAULT_LLM_MODEL);

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
        <ModelConfig 
          selectedModel={selectedModel} 
          onModelChange={setSelectedModel} 
        />
        <ExpertConfig />
        <ScenarioConfig 
          onAnalysisStart={onAnalysisStart} 
          selectedModel={selectedModel}
        />
      </div>
    </aside>
  );
}
