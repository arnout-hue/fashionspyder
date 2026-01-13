import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder, FolderPlus, Loader2, Plus } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  color: string;
  product_count?: number;
}

interface AddToCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  onSuccess?: () => void;
}

export const AddToCollectionDialog = ({
  open,
  onOpenChange,
  productIds,
  onSuccess,
}: AddToCollectionDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    if (open) {
      fetchCollections();
      setSelectedCollections(new Set());
      setShowNewForm(false);
      setNewCollectionName('');
    }
  }, [open]);

  const fetchCollections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('collections')
      .select('id, name, color')
      .order('name');

    if (error) {
      console.error('Error fetching collections:', error);
    } else {
      setCollections(data || []);
    }
    setLoading(false);
  };

  const handleToggleCollection = (collectionId: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };

  const handleCreateAndAdd = async () => {
    if (!newCollectionName.trim()) return;

    setSaving(true);
    try {
      // Create new collection
      const { data: newCollection, error: createError } = await supabase
        .from('collections')
        .insert({
          name: newCollectionName.trim(),
          created_by: user?.id,
          is_shared: true,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add products to new collection
      const insertData = productIds.map((productId) => ({
        product_id: productId,
        collection_id: newCollection.id,
        added_by: user?.id,
      }));

      const { error: insertError } = await supabase
        .from('product_collections')
        .insert(insertData);

      if (insertError) throw insertError;

      await logActivity(
        'Added products to new collection',
        'collection',
        'collection',
        newCollection.id,
        newCollectionName.trim(),
        { product_count: productIds.length }
      );

      toast({
        title: 'Success',
        description: `Created "${newCollectionName}" and added ${productIds.length} product(s)`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create collection';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddToSelected = async () => {
    if (selectedCollections.size === 0) return;

    setSaving(true);
    try {
      // Get existing product-collection links to avoid duplicates
      const { data: existingLinks } = await supabase
        .from('product_collections')
        .select('product_id, collection_id')
        .in('product_id', productIds)
        .in('collection_id', Array.from(selectedCollections));

      const existingSet = new Set(
        (existingLinks || []).map((l) => `${l.product_id}-${l.collection_id}`)
      );

      // Build insert data excluding existing links
      const insertData: { product_id: string; collection_id: string; added_by: string | undefined }[] = [];
      for (const collectionId of selectedCollections) {
        for (const productId of productIds) {
          const key = `${productId}-${collectionId}`;
          if (!existingSet.has(key)) {
            insertData.push({
              product_id: productId,
              collection_id: collectionId,
              added_by: user?.id,
            });
          }
        }
      }

      if (insertData.length > 0) {
        const { error } = await supabase.from('product_collections').insert(insertData);
        if (error) throw error;
      }

      const selectedNames = collections
        .filter((c) => selectedCollections.has(c.id))
        .map((c) => c.name)
        .join(', ');

      await logActivity(
        'Added products to collection(s)',
        'collection',
        'product',
        undefined,
        undefined,
        { product_count: productIds.length, collections: selectedNames }
      );

      const addedCount = insertData.length;
      const skippedCount = productIds.length * selectedCollections.size - addedCount;

      toast({
        title: 'Success',
        description: `Added ${productIds.length} product(s) to ${selectedCollections.size} collection(s)${
          skippedCount > 0 ? ` (${skippedCount} already existed)` : ''
        }`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add to collection';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
          <DialogDescription>
            Add {productIds.length} product{productIds.length !== 1 ? 's' : ''} to one or more
            collections
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : showNewForm ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-collection-name">Collection Name</Label>
              <Input
                id="new-collection-name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g., Spring 2024 Picks"
                autoFocus
              />
            </div>
          </div>
        ) : (
          <div className="py-4">
            {collections.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-center">
                <Folder className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No collections yet</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowNewForm(true)}
                >
                  Create your first collection
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {collections.map((collection) => (
                    <label
                      key={collection.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedCollections.has(collection.id)}
                        onCheckedChange={() => handleToggleCollection(collection.id)}
                      />
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: collection.color }}
                      />
                      <span className="flex-1 font-medium">{collection.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {showNewForm ? (
            <>
              <Button variant="outline" onClick={() => setShowNewForm(false)} disabled={saving}>
                Back
              </Button>
              <Button onClick={handleCreateAndAdd} disabled={!newCollectionName.trim() || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & Add
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowNewForm(true)}
                disabled={saving}
              >
                <FolderPlus className="h-4 w-4" />
                New Collection
              </Button>
              <Button
                onClick={handleAddToSelected}
                disabled={selectedCollections.size === 0 || saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add to {selectedCollections.size || ''} Collection
                {selectedCollections.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddToCollectionDialog;
