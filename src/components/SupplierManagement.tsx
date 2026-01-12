import { useState } from "react";
import { Plus, Pencil, Trash2, Mail, Save, X, Phone, Globe, MapPin, Factory, Target, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface SupplierFormData {
  name: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  factory: string;
  focus_area: string;
  logo_url: string;
  contact_person: string;
  notes: string;
}

const emptyFormData: SupplierFormData = {
  name: "",
  email: "",
  phone: "",
  website: "",
  location: "",
  factory: "",
  focus_area: "",
  logo_url: "",
  contact_person: "",
  notes: "",
};

// Extracted as a stable component to prevent re-mounting on every keystroke
interface SupplierFormFieldsProps {
  formData: SupplierFormData;
  updateField: (field: keyof SupplierFormData, value: string) => void;
}

const SupplierFormFields = ({ formData, updateField }: SupplierFormFieldsProps) => (
  <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">Supplier Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Fashion Forward Ltd"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact_person">Contact Person</Label>
        <Input
          id="contact_person"
          placeholder="e.g., John Smith"
          value={formData.contact_person}
          onChange={(e) => updateField("contact_person", e.target.value)}
          maxLength={100}
        />
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address *</Label>
        <Input
          id="email"
          type="email"
          placeholder="orders@supplier.com"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          maxLength={255}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+31 20 123 4567"
          value={formData.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          maxLength={50}
        />
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          type="url"
          placeholder="https://supplier.com"
          value={formData.website}
          onChange={(e) => updateField("website", e.target.value)}
          maxLength={500}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="logo_url">Logo URL</Label>
        <Input
          id="logo_url"
          type="url"
          placeholder="https://supplier.com/logo.png"
          value={formData.logo_url}
          onChange={(e) => updateField("logo_url", e.target.value)}
          maxLength={500}
        />
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="e.g., Amsterdam, Netherlands"
          value={formData.location}
          onChange={(e) => updateField("location", e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="factory">Factory</Label>
        <Input
          id="factory"
          placeholder="e.g., Portugal, Turkey"
          value={formData.factory}
          onChange={(e) => updateField("factory", e.target.value)}
          maxLength={200}
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="focus_area">Focus Area</Label>
      <Input
        id="focus_area"
        placeholder="e.g., Knitwear, Denim, Dresses"
        value={formData.focus_area}
        onChange={(e) => updateField("focus_area", e.target.value)}
        maxLength={300}
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="notes">Notes</Label>
      <Textarea
        id="notes"
        placeholder="Additional notes about this supplier..."
        value={formData.notes}
        onChange={(e) => updateField("notes", e.target.value)}
        maxLength={1000}
        rows={3}
      />
    </div>
  </div>
);

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
  const [formData, setFormData] = useState<SupplierFormData>(emptyFormData);
  const { toast } = useToast();

  const handleAddSupplier = () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in at least name and email.",
        variant: "destructive",
      });
      return;
    }

    onAddSupplier({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || null,
      website: formData.website.trim() || null,
      location: formData.location.trim() || null,
      factory: formData.factory.trim() || null,
      focus_area: formData.focus_area.trim() || null,
      logo_url: formData.logo_url.trim() || null,
      contact_person: formData.contact_person.trim() || null,
      notes: formData.notes.trim() || null,
    });
    setFormData(emptyFormData);
    setIsAddDialogOpen(false);
    toast({
      title: "Supplier added",
      description: `${formData.name} has been added to your suppliers.`,
    });
  };

  const handleSaveEdit = (supplier: Supplier) => {
    onUpdateSupplier(supplier.id, {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || null,
      website: formData.website.trim() || null,
      location: formData.location.trim() || null,
      factory: formData.factory.trim() || null,
      focus_area: formData.focus_area.trim() || null,
      logo_url: formData.logo_url.trim() || null,
      contact_person: formData.contact_person.trim() || null,
      notes: formData.notes.trim() || null,
    });
    setEditingId(null);
    setFormData(emptyFormData);
    toast({
      title: "Supplier updated",
      description: "Changes have been saved.",
    });
  };

  const startEditing = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone || "",
      website: supplier.website || "",
      location: supplier.location || "",
      factory: supplier.factory || "",
      focus_area: supplier.focus_area || "",
      logo_url: supplier.logo_url || "",
      contact_person: supplier.contact_person || "",
      notes: supplier.notes || "",
    });
  };

  const updateField = (field: keyof SupplierFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Add New Supplier</DialogTitle>
            </DialogHeader>
            <div className="pt-4">
              <SupplierFormFields formData={formData} updateField={updateField} />
              <Button onClick={handleAddSupplier} className="w-full mt-6">
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
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={supplier.logo_url || undefined} alt={supplier.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {supplier.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="font-display text-lg truncate">
                    {supplier.name}
                  </CardTitle>
                  {supplier.contact_person && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {supplier.contact_person}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{supplier.email}</span>
                </div>
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4 flex-shrink-0" />
                    <a 
                      href={supplier.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="truncate hover:text-primary transition-colors"
                    >
                      {supplier.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {supplier.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span>{supplier.location}</span>
                  </div>
                )}
                {supplier.factory && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Factory className="h-4 w-4 flex-shrink-0" />
                    <span>{supplier.factory}</span>
                  </div>
                )}
                {supplier.focus_area && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{supplier.focus_area}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(supplier)}
                      className="flex-1 gap-1.5"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="font-display">Edit Supplier</DialogTitle>
                    </DialogHeader>
                    <div className="pt-4">
                      <SupplierFormFields formData={formData} updateField={updateField} />
                      <Button onClick={() => handleSaveEdit(supplier)} className="w-full mt-6">
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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
