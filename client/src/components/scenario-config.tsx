import { Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

interface ScenarioConfigProps {
  theme: string;
  setTheme: (theme: string) => void;
  currentStrategy: string;
  setCurrentStrategy: (strategy: string) => void;
  targetYears: string;
  setTargetYears: (years: string) => void;
  characterCount: number[];
  setCharacterCount: (count: number[]) => void;
}

export default function ScenarioConfig({ 
  theme, 
  setTheme, 
  currentStrategy, 
  setCurrentStrategy, 
  targetYears, 
  setTargetYears, 
  characterCount, 
  setCharacterCount 
}: ScenarioConfigProps) {

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
    </div>
  );
}
