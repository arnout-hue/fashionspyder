import { SupplierManagement } from "@/components/SupplierManagement";
import { useSuppliers, useAddSupplier, useUpdateSupplier, useDeleteSupplier } from "@/hooks/useSuppliers";
import { TableSkeleton } from "@/components/ProductSkeleton";

export default function ManageSuppliersPage() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const addSupplier = useAddSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  return (
    <SupplierManagement
      suppliers={suppliers}
      onAddSupplier={(supplier) => addSupplier.mutate(supplier)}
      onUpdateSupplier={(id, updates) => updateSupplier.mutate({ id, updates })}
      onDeleteSupplier={(id) => deleteSupplier.mutate(id)}
    />
  );
}
