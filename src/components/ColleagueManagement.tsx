import { useState } from "react";
import { Plus, Pencil, Trash2, Mail, User, Phone, Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

export type Colleague = Tables<"colleagues">;

interface ColleagueFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  notes: string;
}

const emptyFormData: ColleagueFormData = {
  name: "",
  email: "",
  phone: "",
  department: "",
  role: "",
  notes: "",
};

interface ColleagueFormFieldsProps {
  formData: ColleagueFormData;
  updateField: (field: keyof ColleagueFormData, value: string) => void;
}

const ColleagueFormFields = ({ formData, updateField }: ColleagueFormFieldsProps) => (
  <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Jane Doe"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email Address *</Label>
        <Input
          id="email"
          type="email"
          placeholder="jane@company.com"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          maxLength={255}
        />
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
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
      <div className="space-y-2">
        <Label htmlFor="department">Department</Label>
        <Input
          id="department"
          placeholder="e.g., Buying, Design"
          value={formData.department}
          onChange={(e) => updateField("department", e.target.value)}
          maxLength={100}
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="role">Role / Title</Label>
      <Input
        id="role"
        placeholder="e.g., Head of Buying"
        value={formData.role}
        onChange={(e) => updateField("role", e.target.value)}
        maxLength={100}
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="notes">Notes</Label>
      <Textarea
        id="notes"
        placeholder="Additional notes about this colleague..."
        value={formData.notes}
        onChange={(e) => updateField("notes", e.target.value)}
        maxLength={1000}
        rows={3}
      />
    </div>
  </div>
);

interface ColleagueManagementProps {
  colleagues: Colleague[];
  onAddColleague: (colleague: Omit<Colleague, "id" | "created_at" | "updated_at">) => void;
  onUpdateColleague: (id: string, updates: Partial<Colleague>) => void;
  onDeleteColleague: (id: string) => void;
}

export const ColleagueManagement = ({
  colleagues,
  onAddColleague,
  onUpdateColleague,
  onDeleteColleague,
}: ColleagueManagementProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ColleagueFormData>(emptyFormData);
  const { toast } = useToast();

  const handleAddColleague = () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in at least name and email.",
        variant: "destructive",
      });
      return;
    }

    onAddColleague({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || null,
      department: formData.department.trim() || null,
      role: formData.role.trim() || null,
      notes: formData.notes.trim() || null,
    });
    setFormData(emptyFormData);
    setIsAddDialogOpen(false);
    toast({
      title: "Colleague added",
      description: `${formData.name} has been added to your colleagues.`,
    });
  };

  const handleSaveEdit = (colleague: Colleague) => {
    onUpdateColleague(colleague.id, {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || null,
      department: formData.department.trim() || null,
      role: formData.role.trim() || null,
      notes: formData.notes.trim() || null,
    });
    setEditingId(null);
    setFormData(emptyFormData);
    toast({
      title: "Colleague updated",
      description: "Changes have been saved.",
    });
  };

  const startEditing = (colleague: Colleague) => {
    setEditingId(colleague.id);
    setFormData({
      name: colleague.name,
      email: colleague.email,
      phone: colleague.phone || "",
      department: colleague.department || "",
      role: colleague.role || "",
      notes: colleague.notes || "",
    });
  };

  const updateField = (field: keyof ColleagueFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Colleagues</h2>
          <p className="text-muted-foreground">
            Manage internal contacts to share product lists with
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Colleague
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Add New Colleague</DialogTitle>
            </DialogHeader>
            <div className="pt-4">
              <ColleagueFormFields formData={formData} updateField={updateField} />
              <Button onClick={handleAddColleague} className="w-full mt-6">
                Add Colleague
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {colleagues.map((colleague, index) => (
          <Card
            key={colleague.id}
            className="animate-fade-in transition-shadow hover:shadow-card"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {colleague.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="font-display text-lg truncate">
                    {colleague.name}
                  </CardTitle>
                  {colleague.role && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {colleague.role}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{colleague.email}</span>
                </div>
                {colleague.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{colleague.phone}</span>
                  </div>
                )}
                {colleague.department && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4 flex-shrink-0" />
                    <span>{colleague.department}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(colleague)}
                      className="flex-1 gap-1.5"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="font-display">Edit Colleague</DialogTitle>
                    </DialogHeader>
                    <div className="pt-4">
                      <ColleagueFormFields formData={formData} updateField={updateField} />
                      <Button onClick={() => handleSaveEdit(colleague)} className="w-full mt-6">
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
                      <AlertDialogTitle>Delete colleague?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove {colleague.name} from your colleagues list.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDeleteColleague(colleague.id)}
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

      {colleagues.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 rounded-full bg-muted p-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold">No colleagues yet</h3>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Add colleagues to share product lists internally
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Colleague
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ColleagueManagement;
