import { useState, useEffect, useRef } from "react";
import { Search, Store, X, Upload, Plus, Trash2, Tag, Package, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  user_id: string;
}

const CATEGORIES = ["Todos", "Edição", "Design", "Música", "Fotografia", "Roteiro", "Mentoria", "Templates", "Geral"];

const Shopping = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [showMyProducts, setShowMyProducts] = useState(false);

  // Sell form state
  const [sellTitle, setSellTitle] = useState("");
  const [sellDesc, setSellDesc] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellCategory, setSellCategory] = useState("Geral");
  const [sellImage, setSellImage] = useState<File | null>(null);
  const [sellImagePreview, setSellImagePreview] = useState<string | null>(null);
  const [sellLoading, setSellLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
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

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const openProduct = async (product: Product) => {
    setSelectedProduct(product);
    setSellerLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, bio, nivel, created_at, user_id")
      .eq("user_id", product.user_id)
      .maybeSingle();
    setSellerProfile(data ?? null);
    setSellerLoading(false);
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
    if (isNaN(price) || price < 0) {
      toast.error("Preço inválido");
      return;
    }

    setSellLoading(true);
    try {
      let imageUrl: string | null = null;

      if (sellImage) {
        const ext = sellImage.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(path, sellImage, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("products").getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
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

      toast.success("Produto anunciado com sucesso! 🎉");
      setSellTitle("");
      setSellDesc("");
      setSellPrice("");
      setSellCategory("Geral");
      setSellImage(null);
      setSellImagePreview(null);
      setShowSellModal(false);
      fetchProducts();
    } catch {
      toast.error("Erro ao anunciar produto");
    } finally {
      setSellLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { error } = await db
      .from("products")
      .update({ status: "inactive" })
      .eq("id", id)
      .eq("user_id", user!.id);

    if (!error) {
      toast.success("Produto removido");
      fetchMyProducts();
      fetchProducts();
    }
  };

  const memberSince = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const months =
      (now.getFullYear() - d.getFullYear()) * 12 +
      (now.getMonth() - d.getMonth());
    if (months < 1) return "menos de 1 mês";
    if (months < 12) return `${months} mês${months > 1 ? "es" : ""}`;
    const years = Math.floor(months / 12);
    return `${years} ano${years > 1 ? "s" : ""}`;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Store className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">ViralFlow</span>
          </div>
          <h1 className="text-3xl font-bold font-display">
            🏪 <span className="text-gradient-viral">Shopping</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Marketplace de criadores — compre, venda e descubra serviços e produtos digitais
          </p>
        </div>

        {/* Top action bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Pesquisar produtos..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Pesquisar
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowMyProducts(true); fetchMyProducts(); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-accent transition-colors"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Meus Produtos</span>
            </button>
            <button
              onClick={() => setShowSellModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(280,70%,45%)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg"
            >
              <Plus className="h-4 w-4" />
              Vender
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-border animate-pulse">
                <div className="aspect-square bg-muted rounded-t-2xl" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Store className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-muted-foreground">Nenhum produto encontrado</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {search ? `Sem resultados para "${search}"` : "Seja o primeiro a anunciar!"}
            </p>
            <button
              onClick={() => setShowSellModal(true)}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Anunciar produto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => openProduct(product)}
                className="group text-left rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                {/* Image */}
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Category badge */}
                  {product.category && (
                    <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {product.category}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="text-sm font-semibold text-card-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {product.title}
                  </p>
                  <p className="text-base font-bold text-primary mt-1.5">
                    {product.price === 0
                      ? "Grátis"
                      : `R$ ${product.price.toFixed(2).replace(".", ",")}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ======= PRODUCT DETAIL MODAL ======= */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-border overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            {/* Close */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h2 className="font-bold text-base line-clamp-1">{selectedProduct.title}</h2>
              <button onClick={() => { setSelectedProduct(null); setSellerProfile(null); }} className="p-1 rounded-full hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Product image */}
              <div className="aspect-video bg-muted relative">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={selectedProduct.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}
                {selectedProduct.category && (
                  <span className="absolute top-3 left-3 bg-black/60 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {selectedProduct.category}
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4">
                {/* Price */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">
                    {selectedProduct.price === 0
                      ? "Grátis"
                      : `R$ ${selectedProduct.price.toFixed(2).replace(".", ",")}`}
                  </span>
                  <Tag className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedProduct.description}
                  </p>
                )}

                {/* Seller card */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Vendedor</p>
                  {sellerLoading ? (
                    <div className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-muted" />
                      <div className="space-y-2 flex-1">
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="h-3 bg-muted rounded w-1/3" />
                      </div>
                    </div>
                  ) : sellerProfile ? (
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center overflow-hidden shrink-0">
                        {sellerProfile.avatar_url ? (
                          <img src={sellerProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-base">
                            {(sellerProfile.display_name ?? "?")[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{sellerProfile.display_name ?? "Criador"}</p>
                          <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                            Nível {sellerProfile.nivel ?? 1}
                          </span>
                        </div>
                        {sellerProfile.bio && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{sellerProfile.bio}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Prédio na Comunidade
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {memberSince(sellerProfile.created_at)} na plataforma
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Vendedor não encontrado</p>
                  )}
                </div>

                {/* CTA */}
                <button
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(280,70%,45%)] text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
                  onClick={() => toast.info("Em breve: sistema de contato com vendedor!")}
                >
                  Tenho interesse 💬
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======= SELL MODAL ======= */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-border overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h2 className="font-bold text-base">📦 Anunciar Produto</h2>
              <button onClick={() => setShowSellModal(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Image upload */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Imagem do produto</label>
                <button
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors",
                    sellImagePreview ? "border-primary/40" : "border-border hover:border-primary/50"
                  )}
                >
                  {sellImagePreview ? (
                    <img src={sellImagePreview} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Clique para adicionar imagem</p>
                    </>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Título *</label>
                <input
                  value={sellTitle}
                  onChange={(e) => setSellTitle(e.target.value)}
                  placeholder="Ex: Pack de transições para Premiere"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Descrição</label>
                <textarea
                  value={sellDesc}
                  onChange={(e) => setSellDesc(e.target.value)}
                  placeholder="Descreva o que está vendendo..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Preço (R$) *</label>
                  <input
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0,00"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Categoria</label>
                  <select
                    value={sellCategory}
                    onChange={(e) => setSellCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {CATEGORIES.filter((c) => c !== "Todos").map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border shrink-0">
              <button
                onClick={handleSell}
                disabled={sellLoading || !sellTitle.trim() || !sellPrice}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(280,70%,45%)] text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {sellLoading ? "Publicando..." : "Publicar Anúncio 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======= MY PRODUCTS MODAL ======= */}
      {showMyProducts && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-border overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h2 className="font-bold text-base">📦 Meus Produtos</h2>
              <button onClick={() => setShowMyProducts(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {myProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Você ainda não anunciou nada</p>
                  <button
                    onClick={() => { setShowMyProducts(false); setShowSellModal(true); }}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    Anunciar agora
                  </button>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {myProducts.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-1">{p.title}</p>
                        <p className="text-xs text-primary font-bold mt-0.5">
                          {p.price === 0 ? "Grátis" : `R$ ${p.price.toFixed(2).replace(".", ",")}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{p.category}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shopping;
