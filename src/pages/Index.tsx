import { useState, useMemo, useEffect, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { DiscoverView } from "@/components/DiscoverView";
import { ProductList } from "@/components/ProductList";
import { SupplierManagement } from "@/components/SupplierManagement";
import { SupplierOverview } from "@/components/SupplierOverview";
import { CrawlManagement } from "@/components/CrawlManagement";
import { ColleagueManagement, Colleague } from "@/components/ColleagueManagement";
import { UserManagement } from "@/components/UserManagement";
import { ActivityLog } from "@/components/ActivityLog";
import { CollectionManagement } from "@/components/CollectionManagement";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Product,
  Supplier,
} from "@/data/mockData";

type View = "swipe" | "positive" | "negative" | "suppliers" | "crawl" | "supplier-management" | "colleague-management" | "user-management" | "activity-log" | "collections";

const Index = () => {
  const [currentView, setCurrentView] = useState<View>("swipe");
  const [selectedCompetitor, setSelectedCompetitor] = useState("All");
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [competitors, setCompetitors] = useState<string[]>(["All"]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch products from database
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
      return;
    }
    
    if (data) {
      // Map database fields to Product interface
      const mappedProducts: Product[] = data.map(p => ({
        id: p.id,
        name: p.name,
        competitor: p.competitor,
        price: p.price || undefined,
        image_url: p.image_url || undefined,
        product_url: p.product_url,
        sku: p.sku || undefined,
        status: p.status as "pending" | "positive" | "negative" | "requested",
        supplier_id: p.supplier_id || undefined,
        notes: p.notes || undefined,
        is_sent: p.is_sent,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
      setProducts(mappedProducts);
    }
    setIsLoading(false);
  }, []);

  // Fetch suppliers from database
  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching suppliers:', error);
      return;
    }
    
    if (data) {
      setSuppliers(data);
    }
  }, []);

  // Fetch colleagues from database
  const fetchColleagues = useCallback(async () => {
    const { data, error } = await supabase
      .from('colleagues')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching colleagues:', error);
      return;
    }
    
    if (data) {
      setColleagues(data);
    }
  }, []);

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
    fetchProducts();
    fetchSuppliers();
    fetchColleagues();
  }, [fetchProducts, fetchSuppliers, fetchColleagues]);

  // Filter products by competitor
  const filteredProducts = useMemo(() => {
    if (selectedCompetitor === "All") return products;
    return products.filter((p) => p.competitor === selectedCompetitor);
  }, [products, selectedCompetitor]);

  // Categorize products
  const pendingProducts = filteredProducts.filter((p) => p.status === "pending");
  const positiveProducts = filteredProducts.filter((p) => p.status === "positive");
  const negativeProducts = filteredProducts.filter((p) => p.status === "negative");

  // Handlers - update database and local state
  const handleSwipeRight = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'positive' })
      .eq('id', product.id);
    
    if (error) {
      toast.error('Failed to update product');
      return;
    }
    
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, status: "positive" } : p
      )
    );
  };

  const handleSwipeLeft = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'negative' })
      .eq('id', product.id);
    
    if (error) {
      toast.error('Failed to update product');
      return;
    }
    
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, status: "negative" } : p
      )
    );
  };

  const handleBulkStatusChange = async (productIds: string[], status: "positive" | "negative" | "pending") => {
    const { error } = await supabase
      .from('products')
      .update({ 
        status, 
        supplier_id: status === "pending" ? null : undefined 
      })
      .in('id', productIds);
    
    if (error) {
      toast.error('Failed to update products');
      return;
    }
    
    setProducts((prev) =>
      prev.map((p) =>
        productIds.includes(p.id) ? { ...p, status, supplier_id: status === "pending" ? undefined : p.supplier_id } : p
      )
    );
    toast.success(`${productIds.length} products moved to ${status}`);
  };

  const handleBulkAssignSupplier = async (productIds: string[], supplierId: string) => {
    const { error } = await supabase
      .from('products')
      .update({ supplier_id: supplierId })
      .in('id', productIds);
    
    if (error) {
      toast.error('Failed to assign supplier');
      return;
    }
    
    setProducts((prev) =>
      prev.map((p) =>
        productIds.includes(p.id) ? { ...p, supplier_id: supplierId } : p
      )
    );
    toast.success(`Supplier assigned to ${productIds.length} products`);
  };

  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId);
    
    if (error) {
      toast.error('Failed to update product');
      return;
    }
    
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );
  };

  const handleMoveProduct = async (product: Product) => {
    const newStatus = product.status === "positive" ? "negative" : "positive";
    const { error } = await supabase
      .from('products')
      .update({ status: newStatus, supplier_id: null, notes: null })
      .eq('id', product.id);
    
    if (error) {
      toast.error('Failed to move product');
      return;
    }
    
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? { ...p, status: newStatus, supplier_id: undefined, notes: undefined }
          : p
      )
    );
  };

  const handleAddSupplier = async (supplier: Omit<Supplier, "id" | "created_at" | "updated_at">) => {
    const { data, error } = await supabase
      .from('suppliers')
      .insert(supplier)
      .select()
      .single();
    
    if (error) {
      toast.error('Failed to add supplier');
      console.error('Error adding supplier:', error);
      return;
    }
    
    if (data) {
      setSuppliers((prev) => [...prev, data]);
      toast.success('Supplier added');
    }
  };

  const handleUpdateSupplier = async (id: string, updates: Partial<Supplier>) => {
    const { error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to update supplier');
      console.error('Error updating supplier:', error);
      return;
    }
    
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s
      )
    );
    toast.success('Supplier updated');
  };

  const handleDeleteSupplier = async (id: string) => {
    // First unassign products from this supplier
    await supabase
      .from('products')
      .update({ supplier_id: null })
      .eq('supplier_id', id);
    
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete supplier');
      console.error('Error deleting supplier:', error);
      return;
    }
    
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    setProducts((prev) =>
      prev.map((p) =>
        p.supplier_id === id ? { ...p, supplier_id: null } : p
      )
    );
    toast.success('Supplier deleted');
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

  // Colleague handlers
  const handleAddColleague = async (colleague: Omit<Colleague, "id" | "created_at" | "updated_at">) => {
    const { data, error } = await supabase
      .from('colleagues')
      .insert(colleague)
      .select()
      .single();
    
    if (error) {
      toast.error('Failed to add colleague');
      console.error('Error adding colleague:', error);
      return;
    }
    
    if (data) {
      setColleagues((prev) => [...prev, data]);
      toast.success('Colleague added');
    }
  };

  const handleUpdateColleague = async (id: string, updates: Partial<Colleague>) => {
    const { error } = await supabase
      .from('colleagues')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to update colleague');
      console.error('Error updating colleague:', error);
      return;
    }
    
    setColleagues((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
      )
    );
    toast.success('Colleague updated');
  };

  const handleDeleteColleague = async (id: string) => {
    const { error } = await supabase
      .from('colleagues')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete colleague');
      console.error('Error deleting colleague:', error);
      return;
    }
    
    setColleagues((prev) => prev.filter((c) => c.id !== id));
    toast.success('Colleague deleted');
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

      <main className="container py-4 pb-20 md:py-8 md:pb-8">
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
              colleagues={colleagues}
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

        {currentView === "supplier-management" && (
          <SupplierManagement
            suppliers={suppliers}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
          />
        )}

        {currentView === "colleague-management" && (
          <ColleagueManagement
            colleagues={colleagues}
            onAddColleague={handleAddColleague}
            onUpdateColleague={handleUpdateColleague}
            onDeleteColleague={handleDeleteColleague}
          />
        )}

        {currentView === "user-management" && (
          <UserManagement />
        )}

        {currentView === "activity-log" && (
          <ActivityLog />
        )}

        {currentView === "collections" && (
          <CollectionManagement />
        )}
      </main>
    </div>
  );
};

export default Index;
