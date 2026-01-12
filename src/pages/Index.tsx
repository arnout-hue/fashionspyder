import { useState, useMemo, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { DiscoverView } from "@/components/DiscoverView";
import { ProductList } from "@/components/ProductList";
import { SupplierManagement } from "@/components/SupplierManagement";
import { SupplierOverview } from "@/components/SupplierOverview";
import { CrawlManagement } from "@/components/CrawlManagement";
import { supabase } from "@/integrations/supabase/client";
import {
  mockProducts,
  mockSuppliers,
  Product,
  Supplier,
} from "@/data/mockData";

type View = "swipe" | "positive" | "negative" | "suppliers" | "crawl" | "settings";

const Index = () => {
  const [currentView, setCurrentView] = useState<View>("swipe");
  const [selectedCompetitor, setSelectedCompetitor] = useState("All");
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [competitors, setCompetitors] = useState<string[]>(["All"]);

  // Fetch competitors from database
  useEffect(() => {
    const fetchCompetitors = async () => {
      const { data } = await supabase
        .from('competitors')
        .select('name')
        .eq('is_active', true)
        .order('name');
      
      if (data) {
        setCompetitors(["All", ...data.map(c => c.name)]);
      }
    };
    fetchCompetitors();
  }, []);

  // Filter products by competitor
  const filteredProducts = useMemo(() => {
    if (selectedCompetitor === "All") return products;
    return products.filter((p) => p.competitor === selectedCompetitor);
  }, [products, selectedCompetitor]);

  // Categorize products
  const pendingProducts = filteredProducts.filter((p) => p.status === "pending");
  const positiveProducts = filteredProducts.filter((p) => p.status === "positive");
  const negativeProducts = filteredProducts.filter((p) => p.status === "negative");

  // Handlers
  const handleSwipeRight = (product: Product) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, status: "positive" } : p
      )
    );
  };

  const handleSwipeLeft = (product: Product) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, status: "negative" } : p
      )
    );
  };

  const handleBulkStatusChange = (productIds: string[], status: "positive" | "negative" | "pending") => {
    setProducts((prev) =>
      prev.map((p) =>
        productIds.includes(p.id) ? { ...p, status, supplier_id: status === "pending" ? null : p.supplier_id } : p
      )
    );
  };

  const handleBulkAssignSupplier = (productIds: string[], supplierId: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        productIds.includes(p.id) ? { ...p, supplier_id: supplierId } : p
      )
    );
  };

  const handleUpdateProduct = (productId: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );
  };

  const handleMoveProduct = (product: Product) => {
    const newStatus = product.status === "positive" ? "negative" : "positive";
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? { ...p, status: newStatus, supplier_id: null, notes: null }
          : p
      )
    );
  };

  const handleAddSupplier = (supplier: Omit<Supplier, "id" | "created_at" | "updated_at">) => {
    const newSupplier: Supplier = {
      ...supplier,
      id: `sup-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSuppliers((prev) => [...prev, newSupplier]);
  };

  const handleUpdateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s
      )
    );
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    // Unassign products from deleted supplier
    setProducts((prev) =>
      prev.map((p) =>
        p.supplier_id === id ? { ...p, supplier_id: null } : p
      )
    );
  };

  const handleSendRequest = (supplierId: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.supplier_id === supplierId && p.status === "positive" && !p.is_sent
          ? { ...p, is_sent: true, status: "requested" }
          : p
      )
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        currentView={currentView}
        onViewChange={setCurrentView}
        positiveCount={positiveProducts.length}
        negativeCount={negativeProducts.length}
        pendingCount={pendingProducts.length}
        selectedCompetitor={selectedCompetitor}
        onCompetitorChange={setSelectedCompetitor}
        competitors={competitors}
      />

      <main className="container py-8">
        {currentView === "swipe" && (
          <DiscoverView
            products={pendingProducts}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            onBulkStatusChange={handleBulkStatusChange}
          />
        )}

        {currentView === "positive" && (
          <div>
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold">Positive List</h1>
              <p className="mt-2 text-muted-foreground">
                Products you've liked — assign suppliers and add notes
              </p>
            </div>
            <ProductList
              products={positiveProducts}
              suppliers={suppliers}
              type="positive"
              onUpdateProduct={handleUpdateProduct}
              onMoveProduct={handleMoveProduct}
              onBulkStatusChange={handleBulkStatusChange}
              onBulkAssignSupplier={handleBulkAssignSupplier}
            />
          </div>
        )}

        {currentView === "negative" && (
          <div>
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold">Negative List</h1>
              <p className="mt-2 text-muted-foreground">
                Products you've skipped — move back if you change your mind
              </p>
            </div>
            <ProductList
              products={negativeProducts}
              suppliers={suppliers}
              type="negative"
              onUpdateProduct={handleUpdateProduct}
              onMoveProduct={handleMoveProduct}
              onBulkStatusChange={handleBulkStatusChange}
              onBulkAssignSupplier={handleBulkAssignSupplier}
            />
          </div>
        )}

        {currentView === "suppliers" && (
          <SupplierOverview
            suppliers={suppliers}
            products={products}
            onSendRequest={handleSendRequest}
          />
        )}

        {currentView === "crawl" && (
          <CrawlManagement />
        )}

        {currentView === "settings" && (
          <SupplierManagement
            suppliers={suppliers}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
