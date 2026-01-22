import { ColleagueManagement } from "@/components/ColleagueManagement";
import { useColleagues, useAddColleague, useUpdateColleague, useDeleteColleague } from "@/hooks/useColleagues";
import { TableSkeleton } from "@/components/ProductSkeleton";

export default function ManageColleaguesPage() {
  const { data: colleagues = [], isLoading } = useColleagues();
  const addColleague = useAddColleague();
  const updateColleague = useUpdateColleague();
  const deleteColleague = useDeleteColleague();

  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  return (
    <ColleagueManagement
      colleagues={colleagues}
      onAddColleague={(colleague) => addColleague.mutate(colleague)}
      onUpdateColleague={(id, updates) => updateColleague.mutate({ id, updates })}
      onDeleteColleague={(id) => deleteColleague.mutate(id)}
    />
  );
}
