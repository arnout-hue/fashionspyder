import { useState, createContext, useContext } from "react";
import { Outlet } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { useCompetitors } from "@/hooks/useCompetitors";
import { useProductCounts } from "@/hooks/useProducts";

interface AppContextType {
  selectedCompetitor: string;
  setSelectedCompetitor: (competitor: string) => void;
  competitors: string[];
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppLayout");
  }
  return context;
}

export function AppLayout() {
  const [selectedCompetitor, setSelectedCompetitor] = useState("All");
  
  const { data: competitors = ["All"] } = useCompetitors();
  const { data: counts } = useProductCounts(selectedCompetitor);

  return (
    <AppContext.Provider
      value={{
        selectedCompetitor,
        setSelectedCompetitor,
        competitors,
      }}
    >
      <div className="min-h-screen bg-background">
        <Navigation
          positiveCount={counts?.positive || 0}
          negativeCount={counts?.negative || 0}
          pendingCount={counts?.pending || 0}
          trashCount={counts?.trash || 0}
          selectedCompetitor={selectedCompetitor}
          onCompetitorChange={setSelectedCompetitor}
          competitors={competitors}
        />

        <main className="container py-4 pb-20 md:py-8 md:pb-8">
          <Outlet />
        </main>
      </div>
    </AppContext.Provider>
  );
}

export default AppLayout;
