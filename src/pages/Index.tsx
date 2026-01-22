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
import { CollectionDetailView } from "@/components/CollectionDetailView";
import { TrashView } from "@/components/TrashView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Product,
  Supplier,
  ProductWithCollections,
  ProductCollection,
} from "@/data/mockData";

type View = "swipe" | "positive" | "negative" | "suppliers" | "crawl" | "supplier-management" | "colleague-management" | "user-management" | "activity-log" | "collections" | "trash";

const PAGE_SIZE = 50;

const Index = () => {
  const [currentView, setCurrentView] = useState<View>("swipe");
  const [selectedCompetitor, setSelectedCompetitor] = useState("All");
  const [products, setProducts] = useState<ProductWithCollections[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [competitors, setCompetitors] = useState<string[]>(["All"]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Fetch products from database with their collections - now with pagination
  const fetchProducts = useCallback(async (reset = false) => {
    const isReset = reset;
    if (isReset) {
      setIsLoading(true);
      setPage(0);
    } else {
      setIsLoadingMore(true);
    }
    
    const currentPage = isReset ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      // Build query with server-side filtering
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (selectedCompetitor !== "All") {
        query = query.eq('competitor', selectedCompetitor);
      }

      const { data: productsData, count, error: productsError } = await query;
      
      if (productsError) {
        console.error('Error fetching products:', productsError);
        toast.error('Failed to load products');
        return;
      }

      // Fetch product collections for these products only
      const productIds = productsData?.map(p => p.id) || [];
      let collectionsMap = new Map<string, ProductCollection[]>();
      
      if (productIds.length > 0) {
        const { data: productCollectionsData } = await supabase
          .from('product_collections')
          .select('product_id, collection_id, collections(id, name, color)')
          .in('product_id', productIds);
        
        if (productCollectionsData) {
          for (const pc of productCollectionsData) {
            if (pc.product_id && pc.collections) {
              const collection = pc.collections as unknown as { id: string; name: string; color: string };
              if (!collectionsMap.has(pc.product_id)) {
                collectionsMap.set(pc.product_id, []);
              }
              collectionsMap.get(pc.product_id)!.push({
                id: collection.id,
                name: collection.name,
                color: collection.color || '#6366f1',
              });
            }
          }
        }
      }
      
      if (productsData) {
        // Map database fields to ProductWithCollections interface
        const mappedProducts: ProductWithCollections[] = productsData.map(p => ({
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
          collections: collectionsMap.get(p.id) || [],
        }));
        
        if (isReset) {
          setProducts(mappedProducts);
          setPage(1);
        } else {
          setProducts(prev => [...prev, ...mappedProducts]);
          setPage(p => p + 1);
        }
        
        setHasMore(productsData.length === PAGE_SIZE);
        setTotalCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [selectedCompetitor, page]);

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

  // Reset and refetch when competitor changes
  useEffect(() => {
    fetchProducts(true);
  }, [selectedCompetitor]);

  // Initial load of competitors, suppliers, colleagues
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
    fetchSuppliers();
    fetchColleagues();
  }, [fetchSuppliers, fetchColleagues]);

  // Filter products by status (already filtered by competitor in query)
  const pendingProducts = useMemo(() => products.filter((p) => p.status === "pending"), [products]);
  const positiveProducts = useMemo(() => products.filter((p) => p.status === "positive"), [products]);
  const negativeProducts = useMemo(() => products.filter((p) => p.status === "negative"), [products]);
  const trashedProducts = useMemo(() => products.filter((p) => p.status === "trash"), [products]);

  // Handlers - update database and local state
  const handleSwipeRight = async (product: ProductWithCollections) => {
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

  const handleSwipeLeft = async (product: ProductWithCollections) => {
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

  const handleBulkStatusChange = async (productIds: string[], status: "positive" | "negative" | "pending" | "trash") => {
    const { error } = await supabase
      .from('products')
      .update({ 
        status, 
        supplier_id: (status === "pending" || status === "trash") ? null : undefined 
      })
      .in('id', productIds);
    
    if (error) {
      toast.error('Failed to update products');
      return;
    }
    
    setProducts((prev) =>
      prev.map((p) =>
        productIds.includes(p.id) ? { ...p, status, supplier_id: (status === "pending" || status === "trash") ? undefined : p.supplier_id } : p
      )
    );
    const statusLabel = status === "trash" ? "trash" : status;
    toast.success(`${productIds.length} products moved to ${statusLabel}`);
  };

  const handleClearToTrash = async (productIds: string[]) => {
    await handleBulkStatusChange(productIds, "trash");
  };

  const handleRestoreFromTrash = async (productIds: string[], status: "pending" | "positive" | "negative") => {
    await handleBulkStatusChange(productIds, status);
  };

  const handlePermanentDelete = async (productIds: string[]) => {
    // First delete from product_collections
    await supabase
      .from('product_collections')
      .delete()
      .in('product_id', productIds);
    
    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', productIds);
    
    if (error) {
      toast.error('Failed to delete products');
      return;
    }
    
    setProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
    toast.success(`${productIds.length} products permanently deleted`);
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

  const handleMoveProduct = async (product: ProductWithCollections) => {
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
        trashCount={trashedProducts.length}
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
            onClearToTrash={handleClearToTrash}
          />
        )}

        {currentView === "positive" && (
          <div>
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold">Positive List</h1>
              <p className="mt-2 text-muted-foreground">
                Products you've liked — assign suppliers and add notes
                {positiveProducts.length > 0 && ` (${positiveProducts.length} products)`}
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
              onClearToTrash={handleClearToTrash}
            />
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => fetchProducts(false)}
                  disabled={isLoadingMore}
                  className="gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Products'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {currentView === "negative" && (
          <div>
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold">Negative List</h1>
              <p className="mt-2 text-muted-foreground">
                Products you've skipped — move back if you change your mind
                {negativeProducts.length > 0 && ` (${negativeProducts.length} products)`}
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
              onClearToTrash={handleClearToTrash}
            />
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => fetchProducts(false)}
                  disabled={isLoadingMore}
                  className="gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Products'
                  )}
                </Button>
              </div>
            )}
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
          selectedCollectionId ? (
            <CollectionDetailView 
              collectionId={selectedCollectionId} 
              onBack={() => setSelectedCollectionId(null)} 
            />
          ) : (
            <CollectionManagement 
              onViewCollection={(id) => setSelectedCollectionId(id)} 
            />
          )
        )}

        {currentView === "trash" && (
          <div>
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold">Trash</h1>
              <p className="mt-2 text-muted-foreground">
                Cleared items — restore or permanently delete
              </p>
            </div>
            <TrashView
              products={trashedProducts}
              onRestoreProducts={handleRestoreFromTrash}
              onPermanentDelete={handlePermanentDelete}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
