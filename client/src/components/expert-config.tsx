import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, X, Bus, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Expert } from "@shared/schema";

export default function ExpertConfig() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newExpertName, setNewExpertName] = useState("");
  const [newExpertRole, setNewExpertRole] = useState("");
  const [newSpecialization, setNewSpecialization] = useState("");
  const [newSubSpecializations, setNewSubSpecializations] = useState<string[]>([]);
  const [newInformationSources, setNewInformationSources] = useState<string[]>([]);
  const [newExpertiseLevel, setNewExpertiseLevel] = useState("expert");
  const [newResearchFocus, setNewResearchFocus] = useState("");
  const [currentSubSpec, setCurrentSubSpec] = useState("");
  const [currentInfoSource, setCurrentInfoSource] = useState("");
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [hasAppliedPrediction, setHasAppliedPrediction] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: experts = [], isLoading } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const addExpertMutation = useMutation({
    mutationFn: async (expertData: { 
      name: string; 
      role: string; 
      specialization: string;
      subSpecializations?: unknown;
      informationSources?: unknown;
      expertiseLevel?: string;
      researchFocus?: string;
    }) => {
      const response = await apiRequest("POST", "/api/experts", expertData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts"] });
      resetForm();
      setIsAddDialogOpen(false);
      toast({
        title: "専門家を追加しました",
        description: "新しい専門家が追加されました。",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "専門家の追加に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNewExpertName("");
    setNewExpertRole("");
    setNewSpecialization("");
    setNewSubSpecializations([]);
    setNewInformationSources([]);
    setNewExpertiseLevel("expert");
    setNewResearchFocus("");
    setCurrentSubSpec("");
    setCurrentInfoSource("");
    setHasAppliedPrediction(false);
    setIsLoadingPrediction(false);
    setCurrentRequestId(null);
  };


  const deleteExpertMutation = useMutation({
    mutationFn: async (expertId: string) => {
      await apiRequest("DELETE", `/api/experts/${expertId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts"] });
      toast({
        title: "専門家を削除しました",
        description: "専門家が削除されました。",
      });
    },
    onError: () => {
      toast({
        title: "エラー",
        description: "専門家の削除に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const predictExpertInfoMutation = useMutation({
    mutationFn: async ({ name, requestId }: { name: string; requestId: string }) => {
      const response = await apiRequest("POST", "/api/experts/predict", { name });
      const data = await response.json();
      return { data, requestId, status: response.status };
    },
    onSuccess: ({ data, requestId, status }) => {
      // Check if this response is still relevant (no race condition)
      if (requestId !== currentRequestId) {
        console.log('Ignoring stale response for request:', requestId);
        return;
      }
      
      // Check if prediction contains actual content
      const hasContent = data.role?.trim() || 
                        data.specialization?.trim() || 
                        (data.subSpecializations && data.subSpecializations.length > 0) ||
                        (data.informationSources && data.informationSources.length > 0) ||
                        data.researchFocus?.trim();
      
      if (!hasContent && status === 200) {
        // This shouldn't happen with the backend fix, but just in case
        setIsLoadingPrediction(false);
        toast({
          title: "情報が見つかりませんでした",
          description: "この専門家の情報を取得できませんでした。別の名前を試すか、手動で入力してください。",
          variant: "destructive",
        });
        return;
      }
      
      setNewExpertRole(data.role || "");
      setNewSpecialization(data.specialization || "");
      setNewExpertiseLevel(data.expertiseLevel || "expert");
      setNewSubSpecializations(data.subSpecializations || []);
      setNewInformationSources(data.informationSources || []);
      setNewResearchFocus(data.researchFocus || "");
      setHasAppliedPrediction(true);
      setIsLoadingPrediction(false);
      setCurrentRequestId(null);
      
      toast({
        title: "情報を自動設定しました",
        description: "AI が専門家情報を予測して設定しました。必要に応じて編集してください。",
      });
    },
    onError: (error: any, variables) => {
      // Check if this response is still relevant
      if (variables.requestId !== currentRequestId) {
        console.log('Ignoring stale error for request:', variables.requestId);
        return;
      }
      
      setIsLoadingPrediction(false);
      setCurrentRequestId(null);
      
      // Handle specific error responses from backend
      let title = "予測に失敗しました";
      let description = "専門家情報の自動設定ができませんでした。手動で入力してください。";
      
      if (error?.response?.status) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        switch (status) {
          case 429:
            title = "API制限に達しました";
            description = "しばらく時間をおいてから再度お試しください。";
            break;
          case 401:
            title = "認証エラー";
            description = "API設定に問題があります。管理者にお問い合わせください。";
            break;
          case 503:
            if (errorData?.code === 'NO_CONTENT') {
              title = "情報が見つかりませんでした";
              description = "この専門家の情報を取得できませんでした。別の名前を試すか、手動で入力してください。";
            } else {
              title = "サービス一時停止中";
              description = "サービスが一時的に利用できません。しばらく時間をおいてから再度お試しください。";
            }
            break;
          case 400:
            title = "入力エラー";
            description = "専門家名は3文字以上で入力してください。";
            break;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  // Manual prediction function triggered by button click
  const handlePredictExpertInfo = useCallback(() => {
    if (newExpertName.trim().length >= 3) {
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setCurrentRequestId(requestId);
      setIsLoadingPrediction(true);
      predictExpertInfoMutation.mutate({ name: newExpertName.trim(), requestId });
    } else {
      toast({
        title: "入力エラー",
        description: "専門家名は3文字以上で入力してください。",
        variant: "destructive",
      });
    }
  }, [newExpertName, predictExpertInfoMutation, toast]);

  // Handle expert name change and reset prediction state when cleared
  const handleExpertNameChange = (name: string) => {
    setNewExpertName(name);
    
    // If previous prediction was applied and user modifies the name significantly, 
    // clear prediction status to allow new prediction
    if (hasAppliedPrediction && name.trim() !== newExpertName.trim()) {
      setHasAppliedPrediction(false);
    }
    
    // Reset all fields if user clears the name completely
    if (name.trim().length === 0) {
      setHasAppliedPrediction(false);
      setIsLoadingPrediction(false);
      setCurrentRequestId(null);
      setNewExpertRole("");
      setNewSpecialization("");
      setNewSubSpecializations([]);
      setNewInformationSources([]);
      setNewExpertiseLevel("expert");
      setNewResearchFocus("");
    }
  };

  const addSubSpecialization = () => {
    if (currentSubSpec.trim() && !newSubSpecializations.includes(currentSubSpec.trim())) {
      setNewSubSpecializations([...newSubSpecializations, currentSubSpec.trim()]);
      setCurrentSubSpec("");
    }
  };

  const removeSubSpecialization = (index: number) => {
    setNewSubSpecializations(newSubSpecializations.filter((_, i) => i !== index));
  };

  const addInformationSource = () => {
    if (currentInfoSource.trim() && !newInformationSources.includes(currentInfoSource.trim())) {
      setNewInformationSources([...newInformationSources, currentInfoSource.trim()]);
      setCurrentInfoSource("");
    }
  };

  const removeInformationSource = (index: number) => {
    setNewInformationSources(newInformationSources.filter((_, i) => i !== index));
  };

  const handleAddExpert = () => {
    if (!newExpertName.trim() || !newExpertRole.trim() || !newSpecialization.trim()) {
      toast({
        title: "入力エラー",
        description: "専門家名、役割、専門分野を入力してください。",
        variant: "destructive",
      });
      return;
    }

    addExpertMutation.mutate({
      name: newExpertName.trim(),
      role: newExpertRole.trim(),
      specialization: newSpecialization.trim(),
      subSpecializations: newSubSpecializations,
      informationSources: newInformationSources,
      expertiseLevel: newExpertiseLevel,
      researchFocus: newResearchFocus.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Bus className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">専門家設定</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted rounded-lg p-4 border border-border animate-pulse">
              <div className="h-4 bg-muted-foreground/20 rounded mb-2"></div>
              <div className="h-3 bg-muted-foreground/20 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Bus className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground" data-testid="text-expert-config-title">専門家設定</h2>
      </div>
      
      {/* Expert List */}
      <div className="space-y-3">
        {experts.map((expert) => (
          <div key={expert.id} className="expert-card bg-muted rounded-lg p-4 border border-border" data-testid={`card-expert-${expert.id}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground" data-testid={`text-expert-name-${expert.id}`}>
                {expert.name}
              </span>
              <button
                className="text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => deleteExpertMutation.mutate(expert.id)}
                disabled={deleteExpertMutation.isPending}
                data-testid={`button-remove-expert-${expert.id}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground" data-testid={`text-expert-role-${expert.id}`}>
              {expert.role}
            </p>
          </div>
        ))}
      </div>

      {/* Add Expert Button */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
            data-testid="button-add-expert"
          >
            <Plus className="h-4 w-4 mr-2" />
            専門家を追加
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-card" data-testid="dialog-add-expert">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">新しい専門家を追加</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 max-h-96 overflow-y-auto">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <label className="text-sm font-medium text-foreground">専門家名</label>
                {isLoadingPrediction && (
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground" data-testid="indicator-prediction-loading">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>AI予測中...</span>
                  </div>
                )}
                {hasAppliedPrediction && !isLoadingPrediction && (
                  <div className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400" data-testid="indicator-prediction-success">
                    <Sparkles className="h-3 w-3" />
                    <span>AI予測完了</span>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <Input
                  value={newExpertName}
                  onChange={(e) => handleExpertNameChange(e.target.value)}
                  placeholder="例：マーケティング専門家"
                  className="flex-1"
                  data-testid="input-expert-name"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePredictExpertInfo}
                  disabled={isLoadingPrediction || newExpertName.trim().length < 3}
                  className="min-w-[100px]"
                  data-testid="button-predict-expert"
                >
                  {isLoadingPrediction ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      予測中
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      AI予測
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                AI予測ボタンをクリックして専門家情報を自動生成します（3文字以上入力してください）
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground">役割</label>
              <Textarea
                value={newExpertRole}
                onChange={(e) => setNewExpertRole(e.target.value)}
                placeholder="例：デジタルマーケティングの戦略立案と実行支援を行う"
                className="mt-1 resize-none"
                rows={2}
                data-testid="input-expert-role"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">主要専門分野</label>
              <Input
                value={newSpecialization}
                onChange={(e) => setNewSpecialization(e.target.value)}
                placeholder="例：デジタルマーケティング"
                className="mt-1"
                data-testid="input-specialization"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">専門性レベル</label>
              <Select value={newExpertiseLevel} onValueChange={setNewExpertiseLevel}>
                <SelectTrigger className="mt-1" data-testid="select-expertise-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specialist">スペシャリスト</SelectItem>
                  <SelectItem value="expert">エキスパート</SelectItem>
                  <SelectItem value="senior">シニアエキスパート</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">詳細専門領域</label>
              <div className="mt-1 space-y-2">
                <div className="flex space-x-2">
                  <Input
                    value={currentSubSpec}
                    onChange={(e) => setCurrentSubSpec(e.target.value)}
                    placeholder="例：SEO・コンテンツマーケティング"
                    data-testid="input-sub-specialization"
                    onKeyPress={(e) => e.key === 'Enter' && addSubSpecialization()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSubSpecialization}
                    data-testid="button-add-sub-spec"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {newSubSpecializations.map((spec, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs"
                      data-testid={`badge-sub-spec-${index}`}
                    >
                      {spec}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => removeSubSpecialization(index)}
                        data-testid={`button-remove-sub-spec-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">情報源</label>
              <div className="mt-1 space-y-2">
                <div className="flex space-x-2">
                  <Input
                    value={currentInfoSource}
                    onChange={(e) => setCurrentInfoSource(e.target.value)}
                    placeholder="例：学術論文、業界レポート、専門メディア"
                    data-testid="input-info-source"
                    onKeyPress={(e) => e.key === 'Enter' && addInformationSource()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addInformationSource}
                    data-testid="button-add-info-source"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {newInformationSources.map((source, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-xs"
                      data-testid={`badge-info-source-${index}`}
                    >
                      {source}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => removeInformationSource(index)}
                        data-testid={`button-remove-info-source-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">研究焦点（オプション）</label>
              <Textarea
                value={newResearchFocus}
                onChange={(e) => setNewResearchFocus(e.target.value)}
                placeholder="例：持続可能なマーケティング戦略の研究・実装"
                className="mt-1 resize-none"
                rows={2}
                data-testid="input-research-focus"
              />
            </div>
          </div>
          
          <div className="flex space-x-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsAddDialogOpen(false)}
              data-testid="button-cancel-expert"
            >
              キャンセル
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddExpert}
              disabled={addExpertMutation.isPending}
              data-testid="button-submit-expert"
            >
              {addExpertMutation.isPending ? "追加中..." : "追加"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
