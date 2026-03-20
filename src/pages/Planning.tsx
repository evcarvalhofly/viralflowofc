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
  Trophy, Flame, Edit2, Check, X, ChevronDown, ChevronRight,
  FolderOpen
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

type GroupedPlans = {
  date: string;
  label: string;
  plans: DailyPlan[];
};

const Planning = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupedPlans[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editingPlanTitle, setEditingPlanTitle] = useState<string | null>(null);
  const [editPlanTitleText, setEditPlanTitleText] = useState("");
  const [score, setScore] = useState({ total: 0, streak: 0 });

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    fetchPlans();
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

  const fetchPlans = async () => {
    if (!user) return;
    setLoading(true);

    const { data: plans } = await supabase
      .from("daily_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("plan_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!plans || plans.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }

    // Fetch all items for these plans
    const planIds = plans.map(p => p.id);
    const { data: allItems } = await supabase
      .from("plan_items")
      .select("*")
      .in("plan_id", planIds)
      .order("sort_order");

    const itemsByPlan = (allItems || []).reduce((acc: Record<string, PlanItem[]>, item) => {
      if (!acc[item.plan_id]) acc[item.plan_id] = [];
      acc[item.plan_id].push(item as PlanItem);
      return acc;
    }, {});

    const plansWithItems: DailyPlan[] = plans.map(p => ({
      ...p,
      items: itemsByPlan[p.id] || [],
    }));

    // Group by date
    const dateMap = new Map<string, DailyPlan[]>();
    for (const plan of plansWithItems) {
      const date = plan.plan_date;
      if (!dateMap.has(date)) dateMap.set(date, []);
      dateMap.get(date)!.push(plan);
    }

    const grouped: GroupedPlans[] = Array.from(dateMap.entries()).map(([date, plans]) => ({
      date,
      label: formatDateLabel(date),
      plans,
    }));

    setGroups(grouped);

    // Auto-expand today's plans
    const todayPlans = plansWithItems.filter(p => p.plan_date === today);
    setExpandedPlans(new Set(todayPlans.map(p => p.id)));

    setLoading(false);
  };

  const formatDateLabel = (date: string) => {
    if (date === today) return "Hoje";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date === yesterday.toISOString().split("T")[0]) return "Ontem";
    return new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const toggleExpand = (planId: string) => {
    setExpandedPlans(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const addItem = async (planId: string) => {
    const text = newItemText[planId]?.trim();
    if (!text || !user) return;

    const plan = groups.flatMap(g => g.plans).find(p => p.id === planId);
    if (!plan) return;

    const { data } = await supabase
      .from("plan_items")
      .insert({
        plan_id: planId,
        user_id: user.id,
        title: text,
        sort_order: plan.items.length,
      })
      .select()
      .single();

    if (data) {
      setNewItemText(prev => ({ ...prev, [planId]: "" }));
      fetchPlans();
    }
  };

  const toggleItem = async (item: PlanItem) => {
    const newCompleted = !item.completed;
    await supabase.from("plan_items").update({ completed: newCompleted }).eq("id", item.id);

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

    if (newCompleted) toast({ title: "✅ +10 pontos!" });
    fetchPlans();
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from("plan_items").delete().eq("id", itemId);
    fetchPlans();
  };

  const deletePlan = async (planId: string) => {
    await supabase.from("daily_plans").delete().eq("id", planId);
    fetchPlans();
  };

  const startEditItem = (item: PlanItem) => {
    setEditingId(item.id);
    setEditText(item.title);
  };

  const saveEditItem = async () => {
    if (!editingId || !editText.trim()) return;
    await supabase.from("plan_items").update({ title: editText.trim() }).eq("id", editingId);
    setEditingId(null);
    fetchPlans();
  };

  const startEditPlanTitle = (plan: DailyPlan) => {
    setEditingPlanTitle(plan.id);
    setEditPlanTitleText(plan.title);
  };

  const saveEditPlanTitle = async () => {
    if (!editingPlanTitle || !editPlanTitleText.trim()) return;
    await supabase.from("daily_plans").update({ title: editPlanTitleText.trim() }).eq("id", editingPlanTitle);
    setEditingPlanTitle(null);
    fetchPlans();
  };

  const addNewPlan = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("daily_plans")
      .insert({
        user_id: user.id,
        plan_date: today,
        title: `Novo plano - ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      })
      .select()
      .single();
    if (data) {
      fetchPlans();
      setExpandedPlans(prev => new Set(prev).add(data.id));
    }
  };

  // Calculate total progress for today
  const todayPlans = groups.find(g => g.date === today)?.plans || [];
  const totalItems = todayPlans.reduce((sum, p) => sum + p.items.length, 0);
  const completedItems = todayPlans.reduce((sum, p) => sum + p.items.filter(i => i.completed).length, 0);
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 overflow-y-auto h-full pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Planejamento
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button onClick={addNewPlan} size="sm" className="gradient-viral">
          <Plus className="h-4 w-4 mr-1" />
          Novo plano
        </Button>
      </div>

      {/* Score + Progress */}
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

      {totalItems > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progresso de hoje</span>
              <span className="font-medium">{completedItems}/{totalItems}</span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full gradient-viral rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress === 100 && totalItems > 0 && (
              <p className="text-sm text-primary mt-2 font-medium">🎉 Parabéns! Tudo completo hoje!</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plans grouped by date */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum plano ainda.</p>
            <p className="text-sm mt-1">Converse com a IA para gerar seu primeiro plano de criação! 🤖</p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {group.label}
            </h2>

            {group.plans.map((plan) => {
              const isExpanded = expandedPlans.has(plan.id);
              const planCompleted = plan.items.length > 0 && plan.items.every(i => i.completed);
              const planProgress = plan.items.length > 0
                ? `${plan.items.filter(i => i.completed).length}/${plan.items.length}`
                : "vazio";

              return (
                <Card key={plan.id} className={planCompleted ? "border-primary/30 bg-primary/5" : ""}>
                  {/* Plan header - clickable folder */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpand(plan.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}

                    {editingPlanTitle === plan.id ? (
                      <div className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
                        <Input
                          value={editPlanTitleText}
                          onChange={e => setEditPlanTitleText(e.target.value)}
                          className="h-8 text-sm"
                          onKeyDown={e => e.key === "Enter" && saveEditPlanTitle()}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={saveEditPlanTitle}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPlanTitle(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 font-medium text-sm">{plan.title}</span>
                        <span className="text-xs text-muted-foreground">{planProgress}</span>
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={e => { e.stopPropagation(); startEditPlanTitle(plan); }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                          onClick={e => { e.stopPropagation(); deletePlan(plan.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Expanded items */}
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 px-4 space-y-2">
                      {plan.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            item.completed ? "bg-primary/5 border-primary/20" : "border-border"
                          }`}
                        >
                          <Checkbox checked={item.completed} onCheckedChange={() => toggleItem(item)} />

                          {editingId === item.id ? (
                            <div className="flex-1 flex gap-2">
                              <Input
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                className="h-8 text-sm"
                                onKeyDown={e => e.key === "Enter" && saveEditItem()}
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" onClick={saveEditItem}><Check className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                            </div>
                          ) : (
                            <>
                              <span className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                                {item.title}
                              </span>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditItem(item)}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteItem(item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Add item inline */}
                      <div className="flex gap-2 pt-1">
                        <Input
                          value={newItemText[plan.id] || ""}
                          onChange={e => setNewItemText(prev => ({ ...prev, [plan.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && addItem(plan.id)}
                          placeholder="Adicionar tarefa..."
                          className="h-9"
                        />
                        <Button
                          onClick={() => addItem(plan.id)}
                          disabled={!(newItemText[plan.id]?.trim())}
                          size="sm"
                          className="gradient-viral h-9"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
};

export default Planning;
