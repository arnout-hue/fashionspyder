import { useNavigate } from "react-router-dom";
import { CollectionManagement } from "@/components/CollectionManagement";

export default function CollectionsPage() {
  const navigate = useNavigate();

  return (
    <CollectionManagement
      onViewCollection={(collectionId) => navigate(`/collections/${collectionId}`)}
    />
  );
}
