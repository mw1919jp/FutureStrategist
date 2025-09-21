import { useState } from "react";
import { Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LLM_MODELS, DEFAULT_LLM_MODEL, type LLMModel } from "@shared/schema";

interface ModelConfigProps {
  selectedModel: LLMModel;
  onModelChange: (model: LLMModel) => void;
}

export default function ModelConfig({ selectedModel, onModelChange }: ModelConfigProps) {
  // Model display names for better UX
  const getModelDisplayName = (model: LLMModel): string => {
    switch (model) {
      case "gpt-4o-mini":
        return "GPT-4o Mini（推奨・低コスト）";
      case "gpt-5-nano":
        return "GPT-5 Nano（高速）";
      case "gpt-5-mini":
        return "GPT-5 Mini（バランス）";
      case "gpt-5":
        return "GPT-5（最高品質・高コスト）";
      default:
        return model;
    }
  };

  const getCostIndicator = (model: LLMModel): string => {
    switch (model) {
      case "gpt-4o-mini":
        return "💰 低コスト";
      case "gpt-5-nano":
        return "💰💰 低〜中コスト";
      case "gpt-5-mini":
        return "💰💰💰 中コスト";
      case "gpt-5":
        return "💰💰💰💰 高コスト";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Settings className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground" data-testid="text-model-config-title">
          AI モデル設定
        </h2>
      </div>
      
      <div className="space-y-3">
        <div>
          <Label htmlFor="model-select" className="text-sm font-medium text-foreground">
            使用するAIモデル
          </Label>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="mt-1" data-testid="select-model">
              <SelectValue placeholder="モデルを選択" />
            </SelectTrigger>
            <SelectContent>
              {LLM_MODELS.map((model) => (
                <SelectItem key={model} value={model} data-testid={`option-model-${model}`}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{getModelDisplayName(model)}</span>
                    <span className="text-xs text-muted-foreground">{getCostIndicator(model)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            コストと品質のバランスを考慮してモデルを選択してください
          </p>
        </div>
      </div>
    </div>
  );
}