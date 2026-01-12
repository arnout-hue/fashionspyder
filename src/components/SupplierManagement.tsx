import { useState } from "react";
import { Plus, Pencil, Trash2, Mail, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Supplier } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";

interface SupplierManagementProps {
  suppliers: Supplier[];
  onAddSupplier: (supplier: Omit<Supplier, "id" | "created_at" | "updated_at">) => void;
  onUpdateSupplier: (id: string, updates: Partial<Supplier>) => void;
  onDeleteSupplier: (id: string) => void;
}

export const SupplierManagement = ({
  suppliers,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}: SupplierManagementProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "" });
  const { toast } = useToast();

  const handleAddSupplier = () => {
    if (!formData.name || !formData.email) {
      toast({
        title: "Missing fields",
        description: "Please fill in both name and email.",
        variant: "destructive",
      });
      return;
    }

    onAddSupplier({ name: formData.name, email: formData.email });
    setFormData({ name: "", email: "" });
    setIsAddDialogOpen(false);
    toast({
      title: "Supplier added",
      description: `${formData.name} has been added to your suppliers.`,
    });
  };

  const handleSaveEdit = (supplier: Supplier) => {
    onUpdateSupplier(supplier.id, formData);
    setEditingId(null);
    setFormData({ name: "", email: "" });
    toast({
      title: "Supplier updated",
      description: "Changes have been saved.",
    });
  };

  const startEditing = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({ name: supplier.name, email: supplier.email });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Suppliers</h2>
          <p className="text-muted-foreground">
            Manage your supplier contacts for sample requests
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Add New Supplier</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Fashion Forward Ltd"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="orders@supplier.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              <Button onClick={handleAddSupplier} className="w-full">
                Add Supplier
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((supplier, index) => (
          <Card
            key={supplier.id}
            className="animate-fade-in transition-shadow hover:shadow-card"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardHeader className="pb-3">
              {editingId === supplier.id ? (
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="font-display text-lg"
                />
              ) : (
                <CardTitle className="font-display text-lg">
                  {supplier.name}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                {editingId === supplier.id ? (
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="h-8"
                  />
                ) : (
                  <span className="text-sm">{supplier.email}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editingId === supplier.id ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(supplier)}
                      className="flex-1 gap-1.5"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setFormData({ name: "", email: "" });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(supplier)}
                      className="flex-1 gap-1.5"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {supplier.name} from your suppliers list.
                            Products assigned to this supplier will be unassigned.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteSupplier(supplier.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {suppliers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold">No suppliers yet</h3>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Add your first supplier to start assigning products
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Supplier
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SupplierManagement;