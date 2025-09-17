import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, X, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Expert } from "@shared/schema";

export default function ExpertConfig() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newExpertName, setNewExpertName] = useState("");
  const [newExpertRole, setNewExpertRole] = useState("");
  const { toast } = useToast();

  const { data: experts = [], isLoading } = useQuery<Expert[]>({
    queryKey: ["/api/experts"],
  });

  const addExpertMutation = useMutation({
    mutationFn: async (expertData: { name: string; role: string; specialization: string }) => {
      const response = await apiRequest("POST", "/api/experts", expertData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experts"] });
      setIsAddDialogOpen(false);
      setNewExpertName("");
      setNewExpertRole("");
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

  const handleAddExpert = () => {
    if (!newExpertName.trim() || !newExpertRole.trim()) {
      toast({
        title: "入力エラー",
        description: "専門家名と役割を入力してください。",
        variant: "destructive",
      });
      return;
    }

    addExpertMutation.mutate({
      name: newExpertName.trim(),
      role: newExpertRole.trim(),
      specialization: newExpertRole.trim(),
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
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">専門家名</label>
              <Input
                value={newExpertName}
                onChange={(e) => setNewExpertName(e.target.value)}
                placeholder="例：マーケティング専門家"
                className="mt-1"
                data-testid="input-expert-name"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground">役割・専門分野</label>
              <Textarea
                value={newExpertRole}
                onChange={(e) => setNewExpertRole(e.target.value)}
                placeholder="例：デジタルマーケティング、ブランド戦略、顧客体験"
                className="mt-1 resize-none"
                rows={3}
                data-testid="input-expert-role"
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
