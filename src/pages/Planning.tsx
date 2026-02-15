import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Plus, Trash2, Loader2, CalendarDays,
  Trophy, Flame, Edit2, Check, X
} from "lucide-react";

type PlanItem = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  sort_order: number;
};

type DailyPlan = {
  id: string;
  plan_date: string;
  title: string;
  description: string | null;
  items: PlanItem[];
};

const Planning = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [score, setScore] = useState({ total: 0, streak: 0 });

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    fetchPlan();
    fetchScore();
  }, [user]);

  const fetchScore = async () => {
    const { data } = await supabase
      .from("user_scores")
      .select("total_score, streak_days")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data) setScore({ total: data.total_score, streak: data.streak_days });
  };

  const fetchPlan = async () => {
    if (!user) return;
    setLoading(true);

    // Get or create today's plan
    let { data: planData } = await supabase
      .from("daily_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("plan_date", today)
      .maybeSingle();

    if (!planData) {
      const { data: newPlan } = await supabase
        .from("daily_plans")
        .insert({ user_id: user.id, plan_date: today, title: `Plano de ${new Date().toLocaleDateString("pt-BR")}` })
        .select()
        .single();
      planData = newPlan;
    }

    if (planData) {
      const { data: items } = await supabase
        .from("plan_items")
        .select("*")
        .eq("plan_id", planData.id)
        .order("sort_order");

      setPlan({
        ...planData,
        items: (items || []) as PlanItem[],
      });
    }
    setLoading(false);
  };

  const addItem = async () => {
    if (!newItem.trim() || !plan || !user) return;

    const { data } = await supabase
      .from("plan_items")
      .insert({
        plan_id: plan.id,
        user_id: user.id,
        title: newItem.trim(),
        sort_order: plan.items.length,
      })
      .select()
      .single();

    if (data) {
      setPlan({ ...plan, items: [...plan.items, data as PlanItem] });
      setNewItem("");
    }
  };

  const toggleItem = async (item: PlanItem) => {
    const newCompleted = !item.completed;
    await supabase.from("plan_items").update({ completed: newCompleted }).eq("id", item.id);

    const updatedItems = plan!.items.map(i => i.id === item.id ? { ...i, completed: newCompleted } : i);
    setPlan({ ...plan!, items: updatedItems });

    // Update score
    const delta = newCompleted ? 10 : -10;
    const { data: currentScore } = await supabase
      .from("user_scores")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (currentScore) {
      const newTotal = Math.max(0, currentScore.total_score + delta);
      await supabase
        .from("user_scores")
        .update({ total_score: newTotal, last_completed_date: newCompleted ? today : currentScore.last_completed_date })
        .eq("user_id", user!.id);
      setScore(s => ({ ...s, total: newTotal }));
    } else {
      await supabase
        .from("user_scores")
        .insert({ user_id: user!.id, total_score: Math.max(0, delta), last_completed_date: newCompleted ? today : null });
      setScore(s => ({ ...s, total: Math.max(0, delta) }));
    }

    if (newCompleted) {
      toast({ title: "✅ +10 pontos!", description: "Continue assim!" });
    }
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from("plan_items").delete().eq("id", itemId);
    setPlan({ ...plan!, items: plan!.items.filter(i => i.id !== itemId) });
  };

  const startEdit = (item: PlanItem) => {
    setEditingId(item.id);
    setEditText(item.title);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await supabase.from("plan_items").update({ title: editText.trim() }).eq("id", editingId);
    setPlan({
      ...plan!,
      items: plan!.items.map(i => i.id === editingId ? { ...i, title: editText.trim() } : i),
    });
    setEditingId(null);
  };

  const completedCount = plan?.items.filter(i => i.completed).length || 0;
  const totalCount = plan?.items.length || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-primary" />
          Planejamento Diário
        </h1>
        <p className="text-muted-foreground text-sm flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-accent" />
            <div>
              <p className="text-2xl font-bold font-display">{score.total}</p>
              <p className="text-xs text-muted-foreground">Pontos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Flame className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold font-display">{score.streak}</p>
              <p className="text-xs text-muted-foreground">Dias seguidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progresso do dia</span>
              <span className="font-medium">{completedCount}/{totalCount}</span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full gradient-viral rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress === 100 && (
              <p className="text-sm text-primary mt-2 font-medium">🎉 Parabéns! Você completou tudo hoje!</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">Checklist de Criação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plan?.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                item.completed ? "bg-primary/5 border-primary/20" : "border-border"
              }`}
            >
              <Checkbox
                checked={item.completed}
                onCheckedChange={() => toggleItem(item)}
              />

              {editingId === item.id ? (
                <div className="flex-1 flex gap-2">
                  <Input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={e => e.key === "Enter" && saveEdit()}
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.title}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(item)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}

          {/* Add item */}
          <div className="flex gap-2 pt-2">
            <Input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              placeholder="Adicionar tarefa..."
              className="h-9"
            />
            <Button onClick={addItem} disabled={!newItem.trim()} size="sm" className="gradient-viral h-9">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {plan?.items.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">
              Nenhuma tarefa ainda. Adicione itens ou peça para a IA criar um plano! 🤖
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Planning;
