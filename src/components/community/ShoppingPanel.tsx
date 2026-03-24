import { useState, useEffect, useRef } from "react";
import { X, Search, Plus, Upload, Package, Tag, Trash2, MapPin, Clock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import DirectChatWindow from "./DirectChatWindow";

interface Product {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  created_at: string;
}

interface SellerProfile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  nivel: number | null;
  created_at: string;
}

const CATEGORIES = ["Todos", "Edição", "Design", "Música", "Fotografia", "Roteiro", "Mentoria", "Templates", "Geral"];

interface ShoppingPanelProps {
  onClose: () => void;
}

export const ShoppingPanel = ({ onClose }: ShoppingPanelProps) => {
  const { user } = useAuth();
  const [view, setView] = useState<"list" | "detail" | "sell" | "myproducts">("list");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);

  const [chatPeerId, setChatPeerId] = useState<string | null>(null);
  const [chatPeerName, setChatPeerName] = useState('');
  const [chatPeerAvatar, setChatPeerAvatar] = useState<string | null>(null);

  // Sell form
  const [sellTitle, setSellTitle] = useState("");
  const [sellDesc, setSellDesc] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellCategory, setSellCategory] = useState("Geral");
  const [sellImage, setSellImage] = useState<File | null>(null);
  const [sellImagePreview, setSellImagePreview] = useState<string | null>(null);
  const [sellLoading, setSellLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const fetchProducts = async () => {
    setLoading(true);
    let query = db
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (search) query = query.ilike("title", `%${search}%`);
    if (activeCategory !== "Todos") query = query.eq("category", activeCategory);

    const { data } = await query;
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  const fetchMyProducts = async () => {
    if (!user) return;
    const { data } = await db
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyProducts((data as Product[]) ?? []);
  };

  useEffect(() => {
    fetchProducts();
  }, [search, activeCategory]);

  const openProduct = async (product: Product) => {
    setSelectedProduct(product);
    setSellerProfile(null);
    setView("detail");
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, bio, nivel, created_at")
      .eq("user_id", product.user_id)
      .maybeSingle();
    setSellerProfile(data ?? null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSellImage(file);
    setSellImagePreview(URL.createObjectURL(file));
  };

  const handleSell = async () => {
    if (!user || !sellTitle.trim() || !sellPrice) return;
    const price = parseFloat(sellPrice);
    if (isNaN(price) || price < 0) { toast.error("Preço inválido"); return; }

    setSellLoading(true);
    try {
      let imageUrl: string | null = null;
      if (sellImage) {
        const ext = sellImage.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("products").upload(path, sellImage, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("products").getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }
      }

      const { error } = await db.from("products").insert({
        user_id: user.id,
        title: sellTitle.trim(),
        description: sellDesc.trim() || null,
        price,
        image_url: imageUrl,
        category: sellCategory,
        status: "active",
      });

      if (error) throw error;
      toast.success("Produto anunciado! 🎉");
      setSellTitle(""); setSellDesc(""); setSellPrice(""); setSellCategory("Geral");
      setSellImage(null); setSellImagePreview(null);
      setView("list");
      fetchProducts();
    } catch {
      toast.error("Erro ao anunciar produto");
    } finally {
      setSellLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await db.from("products").update({ status: "inactive" })
      .eq("id", id).eq("user_id", user!.id);
    if (!error) { toast.success("Removido"); fetchMyProducts(); fetchProducts(); }
  };

  const memberSince = (dateStr: string) => {
    const months = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months < 1) return "menos de 1 mês";
    if (months < 12) return `${months} mês${months > 1 ? "es" : ""}`;
    const y = Math.floor(months / 12);
    return `${y} ano${y > 1 ? "s" : ""}`;
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:w-[420px] h-[90vh] sm:h-full bg-background border-l border-border shadow-2xl flex flex-col rounded-t-3xl sm:rounded-none">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <button onClick={() => setView("list")} className="p-1 rounded-full hover:bg-muted mr-1">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-lg">🏪</span>
            <h2 className="font-bold text-base">
              {view === "list" && "Shopping da Comunidade"}
              {view === "detail" && selectedProduct?.title}
              {view === "sell" && "Anunciar Produto"}
              {view === "myproducts" && "Meus Produtos"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ===== LIST VIEW ===== */}
        {view === "list" && (
          <>
            {/* Search + actions */}
            <div className="p-3 border-b border-border space-y-2 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <button
                  onClick={() => { setView("myproducts"); fetchMyProducts(); }}
                  className="px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm font-medium hover:bg-accent"
                >
                  Meus
                </button>
                <button
                  onClick={() => setView("sell")}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Vender
                </button>
              </div>
              {/* Categories */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      activeCategory === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card animate-pulse">
                      <div className="aspect-square bg-muted rounded-t-xl" />
                      <div className="p-2 space-y-1.5">
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {search ? `Sem resultados para "${search}"` : "Nenhum produto ainda. Seja o primeiro!"}
                  </p>
                  <button onClick={() => setView("sell")} className="mt-4 flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                    <Plus className="h-4 w-4" /> Anunciar
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {products.map((p) => (
                    <button key={p.id} onClick={() => openProduct(p)}
                      className="group text-left rounded-xl bg-card border border-border overflow-hidden hover:shadow-md hover:border-primary/40 transition-all">
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          : <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-muted-foreground/30" /></div>
                        }
                        {p.category && (
                          <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                            {p.category}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold line-clamp-2 leading-snug">{p.title}</p>
                        <p className="text-sm font-bold text-primary mt-1">
                          {p.price === 0 ? "Grátis" : `R$ ${p.price.toFixed(2).replace(".", ",")}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== DETAIL VIEW ===== */}
        {view === "detail" && selectedProduct && (
          <div className="flex-1 overflow-y-auto">
            <div className="aspect-video bg-muted relative">
              {selectedProduct.image_url
                ? <img src={selectedProduct.image_url} alt={selectedProduct.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Package className="h-14 w-14 text-muted-foreground/30" /></div>
              }
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base">{selectedProduct.title}</h3>
                  {selectedProduct.category && (
                    <span className="text-xs text-muted-foreground">{selectedProduct.category}</span>
                  )}
                </div>
                <span className="text-xl font-bold text-primary shrink-0">
                  {selectedProduct.price === 0 ? "Grátis" : `R$ ${selectedProduct.price.toFixed(2).replace(".", ",")}`}
                </span>
              </div>

              {selectedProduct.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedProduct.description}</p>
              )}

              {/* Seller */}
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Vendedor</p>
                {sellerProfile ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center overflow-hidden shrink-0">
                      {sellerProfile.avatar_url
                        ? <img src={sellerProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-primary-foreground font-bold">{(sellerProfile.display_name ?? "?")[0].toUpperCase()}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm">{sellerProfile.display_name ?? "Criador"}</p>
                        <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">Nv {sellerProfile.nivel ?? 1}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <svg width="14" height="18" viewBox="0 0 60 100" className="shrink-0">
                            {(() => {
                              const nv = sellerProfile.nivel ?? 1;
                              if (nv >= 5) return (<><polygon points="30,60 55,72.5 55,95 30,82.5" fill="#9333ea" /><polygon points="30,60 5,72.5 5,95 30,82.5" fill="#c084fc" /><polygon points="30,15 50,25 50,72 30,62" fill="#9333ea" /><polygon points="30,15 10,25 10,72 30,62" fill="#c084fc" /><polygon points="10,25 30,15 50,25 30,35" fill="#e9d5ff" /><polygon points="30,5 36,9 30,13 24,9" fill="#a855f7" /></>);
                              if (nv >= 4) return (<><polygon points="30,55 54,68 54,95 30,82" fill="#475569" /><polygon points="30,55 6,68 6,95 30,82" fill="#64748b" /><polygon points="30,20 50,30 50,68 30,58" fill="#475569" /><polygon points="30,20 10,30 10,68 30,58" fill="#64748b" /><polygon points="10,30 30,20 50,30 30,40" fill="#cbd5e1" /></>);
                              if (nv >= 3) return (<><polygon points="30,50 56,63 56,95 30,82" fill="#059669" /><polygon points="30,50 4,63 4,95 30,82" fill="#10b981" /><polygon points="30,25 52,36 52,63 30,52" fill="#10b981" /><polygon points="30,25 8,36 8,63 30,52" fill="#34d399" /><polygon points="8,36 30,25 52,36 30,46" fill="#a7f3d0" /></>);
                              if (nv >= 2) return (<><polygon points="30,45 54,57 54,95 30,83" fill="#2563eb" /><polygon points="30,45 6,57 6,95 30,83" fill="#3b82f6" /><polygon points="30,28 50,38 50,57 30,47" fill="#3b82f6" /><polygon points="30,28 10,38 10,57 30,47" fill="#60a5fa" /><polygon points="10,38 30,28 50,38 30,48" fill="#bfdbfe" /></>);
                              return (<><polygon points="30,50 52,61 52,95 30,84" fill="#94a3b8" /><polygon points="30,50 8,61 8,95 30,84" fill="#cbd5e1" /><polygon points="8,61 30,50 52,61 30,72" fill="#e2e8f0" /><polygon points="30,38 38,43 30,48 22,43" fill="#f43f5e" /></>);
                            })()}
                          </svg>
                          Prédio na Comunidade
                        </span>
                        <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {memberSince(sellerProfile.created_at)}</span>
                      </div>
                    </div>
                    {/* Prédio isométrico do vendedor — lado direito */}
                    <div className="shrink-0 w-[40px] h-[50px] flex items-end justify-center rounded-lg bg-gradient-to-b from-primary/5 to-primary/15 border border-border/50">
                      <svg width="32" height="42" viewBox="0 0 60 100">
                        {(() => {
                          const nv = sellerProfile.nivel ?? 1;
                          if (nv >= 5) return (<><polygon points="30,60 55,72.5 55,95 30,82.5" fill="#9333ea" /><polygon points="30,60 5,72.5 5,95 30,82.5" fill="#c084fc" /><polygon points="30,15 50,25 50,72 30,62" fill="#9333ea" /><polygon points="30,15 10,25 10,72 30,62" fill="#c084fc" /><polygon points="10,25 30,15 50,25 30,35" fill="#e9d5ff" /><polygon points="30,5 36,9 30,13 24,9" fill="#a855f7" /></>);
                          if (nv >= 4) return (<><polygon points="30,55 54,68 54,95 30,82" fill="#475569" /><polygon points="30,55 6,68 6,95 30,82" fill="#64748b" /><polygon points="30,20 50,30 50,68 30,58" fill="#475569" /><polygon points="30,20 10,30 10,68 30,58" fill="#64748b" /><polygon points="10,30 30,20 50,30 30,40" fill="#cbd5e1" /></>);
                          if (nv >= 3) return (<><polygon points="30,50 56,63 56,95 30,82" fill="#059669" /><polygon points="30,50 4,63 4,95 30,82" fill="#10b981" /><polygon points="30,25 52,36 52,63 30,52" fill="#10b981" /><polygon points="30,25 8,36 8,63 30,52" fill="#34d399" /><polygon points="8,36 30,25 52,36 30,46" fill="#a7f3d0" /></>);
                          if (nv >= 2) return (<><polygon points="30,45 54,57 54,95 30,83" fill="#2563eb" /><polygon points="30,45 6,57 6,95 30,83" fill="#3b82f6" /><polygon points="30,28 50,38 50,57 30,47" fill="#3b82f6" /><polygon points="30,28 10,38 10,57 30,47" fill="#60a5fa" /><polygon points="10,38 30,28 50,38 30,48" fill="#bfdbfe" /></>);
                          return (<><polygon points="30,50 52,61 52,95 30,84" fill="#94a3b8" /><polygon points="30,50 8,61 8,95 30,84" fill="#cbd5e1" /><polygon points="8,61 30,50 52,61 30,72" fill="#e2e8f0" /><polygon points="30,38 38,43 30,48 22,43" fill="#f43f5e" /></>);
                        })()}
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="h-10 bg-muted animate-pulse rounded-lg" />
                )}
              </div>

              {user && selectedProduct && user.id !== selectedProduct.user_id && (
                <button
                  onClick={() => {
                    setChatPeerId(selectedProduct.user_id);
                    setChatPeerName(sellerProfile?.display_name ?? 'Vendedor');
                    setChatPeerAvatar(sellerProfile?.avatar_url ?? null);
                  }}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  Tenho interesse 💬
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== SELL VIEW ===== */}
        {view === "sell" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Image */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Imagem</label>
                <button onClick={() => fileRef.current?.click()}
                  className={cn("w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 overflow-hidden transition-colors",
                    sellImagePreview ? "border-primary/40" : "border-border hover:border-primary/50")}>
                  {sellImagePreview
                    ? <img src={sellImagePreview} alt="" className="w-full h-full object-cover rounded-xl" />
                    : <><Upload className="h-7 w-7 text-muted-foreground" /><p className="text-xs text-muted-foreground">Toque para adicionar</p></>
                  }
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Título *</label>
                <input value={sellTitle} onChange={(e) => setSellTitle(e.target.value)}
                  placeholder="Ex: Pack de efeitos sonoros"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Descrição</label>
                <textarea value={sellDesc} onChange={(e) => setSellDesc(e.target.value)}
                  placeholder="O que você está vendendo..." rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Preço (R$) *</label>
                  <input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0,00" type="number" min="0" step="0.01"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Categoria</label>
                  <select value={sellCategory} onChange={(e) => setSellCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                    {CATEGORIES.filter((c) => c !== "Todos").map((cat) => <option key={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border shrink-0">
              <button onClick={handleSell} disabled={sellLoading || !sellTitle.trim() || !sellPrice}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                {sellLoading ? "Publicando..." : "Publicar Anúncio 🚀"}
              </button>
            </div>
          </>
        )}

        {/* ===== MY PRODUCTS VIEW ===== */}
        {view === "myproducts" && (
          <div className="flex-1 overflow-y-auto p-3">
            {myProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Você não tem anúncios</p>
                <button onClick={() => setView("sell")} className="mt-4 flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                  <Plus className="h-4 w-4" /> Anunciar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {myProducts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground/40" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-1">{p.title}</p>
                      <p className="text-xs text-primary font-bold">{p.price === 0 ? "Grátis" : `R$ ${p.price.toFixed(2).replace(".", ",")}`}</p>
                    </div>
                    <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {chatPeerId && (
      <DirectChatWindow
        peerId={chatPeerId}
        peerName={chatPeerName}
        peerAvatar={chatPeerAvatar}
        onClose={() => setChatPeerId(null)}
      />
    )}
    </>
  );
};
