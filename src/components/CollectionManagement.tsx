import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Folder,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  Users,
  Lock,
} from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  created_by: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

interface CollectionManagementProps {
  onViewCollection?: (collectionId: string) => void;
}

const colorOptions = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ef4444', label: 'Red' },
  { value: '#14b8a6', label: 'Teal' },
];

export const CollectionManagement = ({ onViewCollection }: CollectionManagementProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    is_shared: true,
  });

  const fetchCollections = useCallback(async () => {
    setLoading(true);

    // Fetch collections with product counts
    const { data: collectionsData, error: collectionsError } = await supabase
      .from('collections')
      .select('*')
      .order('name');

    if (collectionsError) {
      console.error('Error fetching collections:', collectionsError);
      setLoading(false);
      return;
    }

    // Get product counts for each collection
    const { data: countsData } = await supabase
      .from('product_collections')
      .select('collection_id');

    const countMap = new Map<string, number>();
    countsData?.forEach((pc: { collection_id: string }) => {
      const current = countMap.get(pc.collection_id) || 0;
      countMap.set(pc.collection_id, current + 1);
    });

    const collectionsWithCounts = (collectionsData || []).map((c: Collection) => ({
      ...c,
      product_count: countMap.get(c.id) || 0,
    }));

    setCollections(collectionsWithCounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#6366f1',
      is_shared: true,
    });
  };

  const handleAddCollection = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Collection name is required',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('collections')
      .insert({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        color: formData.color,
        is_shared: formData.is_shared,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await logActivity(
        'Created collection',
        'collection',
        'collection',
        data.id,
        formData.name,
        { is_shared: formData.is_shared }
      );
      toast({
        title: 'Success',
        description: `Collection "${formData.name}" created`,
      });
      setIsAddDialogOpen(false);
      resetForm();
      fetchCollections();
    }
  };

  const handleEditCollection = async () => {
    if (!editingCollection) return;

    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Collection name is required',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('collections')
      .update({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        color: formData.color,
        is_shared: formData.is_shared,
      })
      .eq('id', editingCollection.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await logActivity(
        'Updated collection',
        'collection',
        'collection',
        editingCollection.id,
        formData.name
      );
      toast({
        title: 'Success',
        description: `Collection "${formData.name}" updated`,
      });
      setEditingCollection(null);
      resetForm();
      fetchCollections();
    }
  };

  const handleDeleteCollection = async (collection: Collection) => {
    const { error } = await supabase.from('collections').delete().eq('id', collection.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      await logActivity(
        'Deleted collection',
        'collection',
        'collection',
        collection.id,
        collection.name
      );
      toast({
        title: 'Deleted',
        description: `Collection "${collection.name}" has been removed`,
      });
      fetchCollections();
    }
  };

  const openEditDialog = (collection: Collection) => {
    setFormData({
      name: collection.name,
      description: collection.description || '',
      color: collection.color,
      is_shared: collection.is_shared,
    });
    setEditingCollection(collection);
  };

  const CollectionForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Spring 2024 Picks"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setFormData({ ...formData, color: color.value })}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                formData.color === color.value
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.label}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="shared">Shared Collection</Label>
          <p className="text-sm text-muted-foreground">
            Allow all team members to view this collection
          </p>
        </div>
        <Switch
          id="shared"
          checked={formData.is_shared}
          onCheckedChange={(checked) => setFormData({ ...formData, is_shared: checked })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Collections</h1>
          <p className="mt-2 text-muted-foreground">
            Organize products into custom collections
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Collection</DialogTitle>
              <DialogDescription>
                Create a new collection to organize your products
              </DialogDescription>
            </DialogHeader>
            <CollectionForm />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCollection}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : collections.length === 0 ? (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center text-center">
            <Folder className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-semibold">No collections yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first collection to organize products
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Card
              key={collection.id}
              className="group cursor-pointer transition-all hover:shadow-lg"
              onClick={() => onViewCollection?.(collection.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: collection.color }}
                  >
                    <FolderOpen className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(collection);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Collection?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove "{collection.name}" and unlink all products. The
                            products themselves will not be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteCollection(collection)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardTitle className="mt-3">{collection.name}</CardTitle>
                {collection.description && (
                  <CardDescription className="line-clamp-2">
                    {collection.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>{collection.product_count || 0} products</span>
                  </div>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCollection} onOpenChange={() => setEditingCollection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
            <DialogDescription>Update collection details</DialogDescription>
          </DialogHeader>
          <CollectionForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCollection(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditCollection}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollectionManagement;
