import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Mail,
  Package,
  Send,
  Trash2,
  Users,
  Lock,
  FolderOpen,
} from 'lucide-react';
import { formatPrice } from '@/data/mockData';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_shared: boolean;
}

interface CollectionProduct {
  id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  product_url: string;
  competitor: string;
  notes: string | null;
}

interface CollectionDetailViewProps {
  collectionId: string;
  onBack: () => void;
}

export const CollectionDetailView = ({ collectionId, onBack }: CollectionDetailViewProps) => {
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<CollectionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailForm, setEmailForm] = useState({
    recipientEmail: '',
    recipientName: '',
    message: '',
  });

  const fetchCollectionData = useCallback(async () => {
    setLoading(true);

    // Fetch collection details
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .single();

    if (collectionError) {
      console.error('Error fetching collection:', collectionError);
      toast({
        title: 'Error',
        description: 'Failed to load collection',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setCollection(collectionData);

    // Fetch products in this collection
    const { data: productCollections, error: pcError } = await supabase
      .from('product_collections')
      .select('product_id')
      .eq('collection_id', collectionId);

    if (pcError) {
      console.error('Error fetching product collections:', pcError);
      setLoading(false);
      return;
    }

    const productIds = productCollections?.map(pc => pc.product_id) || [];

    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, image_url, product_url, competitor, notes')
        .in('id', productIds);

      if (productsError) {
        console.error('Error fetching products:', productsError);
      } else {
        setProducts(productsData || []);
      }
    } else {
      setProducts([]);
    }

    setLoading(false);
  }, [collectionId, toast]);

  useEffect(() => {
    fetchCollectionData();
  }, [fetchCollectionData]);

  const handleToggleSelect = (productId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const handleRemoveFromCollection = async () => {
    if (selectedIds.size === 0) return;

    const { error } = await supabase
      .from('product_collections')
      .delete()
      .eq('collection_id', collectionId)
      .in('product_id', Array.from(selectedIds));

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await logActivity(
        `Removed ${selectedIds.size} products from collection`,
        'collection',
        'collection',
        collectionId,
        collection?.name,
        { removed_count: selectedIds.size }
      );
      toast({
        title: 'Removed',
        description: `${selectedIds.size} product(s) removed from collection`,
      });
      setSelectedIds(new Set());
      setRemoveDialogOpen(false);
      fetchCollectionData();
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.recipientEmail || !emailForm.recipientName) {
      toast({
        title: 'Validation Error',
        description: 'Please enter recipient email and name',
        variant: 'destructive',
      });
      return;
    }

    const productsToSend = selectedIds.size > 0
      ? products.filter(p => selectedIds.has(p.id))
      : products;

    if (productsToSend.length === 0) {
      toast({
        title: 'No products',
        description: 'There are no products to send',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-collection-email', {
        body: {
          recipientEmail: emailForm.recipientEmail,
          recipientName: emailForm.recipientName,
          collectionName: collection?.name || 'Collection',
          products: productsToSend.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price ? formatPrice(p.price) : undefined,
            image_url: p.image_url,
            product_url: p.product_url,
            competitor: p.competitor,
            notes: p.notes,
          })),
          customMessage: emailForm.message || undefined,
        },
      });

      if (error) throw error;

      await logActivity(
        `Emailed collection to ${emailForm.recipientEmail}`,
        'email',
        'collection',
        collectionId,
        collection?.name,
        { recipient: emailForm.recipientEmail, products_count: productsToSend.length }
      );

      toast({
        title: 'Email Sent',
        description: `Collection sent to ${emailForm.recipientEmail}`,
      });

      setEmailDialogOpen(false);
      setEmailForm({ recipientEmail: '', recipientName: '', message: '' });
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Collection not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Collections
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="flex h-12 w-12 items-center justify-center rounded-lg"
            style={{ backgroundColor: collection.color }}
          >
            <FolderOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">{collection.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-muted-foreground">{products.length} products</span>
              <Badge variant="outline" className="gap-1">
                {collection.is_shared ? (
                  <>
                    <Users className="h-3 w-3" />
                    Shared
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" />
                    Private
                  </>
                )}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setRemoveDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove ({selectedIds.size})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            disabled={products.length === 0}
          >
            <Mail className="mr-2 h-4 w-4" />
            Email {selectedIds.size > 0 ? `(${selectedIds.size})` : 'Collection'}
          </Button>
        </div>
      </div>

      {collection.description && (
        <p className="text-muted-foreground">{collection.description}</p>
      )}

      {/* Select All */}
      {products.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {selectedIds.size === products.length ? 'Deselect All' : 'Select All'}
          </Button>
          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} of {products.length} selected
            </span>
          )}
        </div>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center text-center">
            <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-semibold">No products in this collection</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Add products from the Discover or Positive lists
            </p>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Collections
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map(product => {
            const isSelected = selectedIds.has(product.id);
            return (
              <Card
                key={product.id}
                className={`group cursor-pointer overflow-hidden transition-all ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleToggleSelect(product.id)}
              >
                <div className="relative aspect-square bg-muted">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <svg className="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2" title={product.name}>
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{product.competitor}</span>
                    {product.price && (
                      <span className="text-sm font-semibold">{formatPrice(product.price)}</span>
                    )}
                  </div>
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Product <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from collection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedIds.size} product(s) from "{collection.name}". 
              The products themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromCollection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Collection</DialogTitle>
            <DialogDescription>
              Send {selectedIds.size > 0 ? `${selectedIds.size} selected products` : `all ${products.length} products`} from this collection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipientName">Recipient Name *</Label>
              <Input
                id="recipientName"
                value={emailForm.recipientName}
                onChange={(e) => setEmailForm(prev => ({ ...prev, recipientName: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Recipient Email *</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={emailForm.recipientEmail}
                onChange={(e) => setEmailForm(prev => ({ ...prev, recipientEmail: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                value={emailForm.message}
                onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Add a personal message to accompany the collection..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
