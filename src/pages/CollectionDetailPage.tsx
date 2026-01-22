import { useParams, useNavigate } from "react-router-dom";
import { CollectionDetailView } from "@/components/CollectionDetailView";

export default function CollectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  if (!id) {
    navigate("/collections");
    return null;
  }

  return (
    <CollectionDetailView
      collectionId={id}
      onBack={() => navigate("/collections")}
    />
  );
}
