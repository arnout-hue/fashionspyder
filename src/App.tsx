import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import DiscoverPage from "./pages/DiscoverPage";
import PositiveListPage from "./pages/PositiveListPage";
import NegativeListPage from "./pages/NegativeListPage";
import SuppliersPage from "./pages/SuppliersPage";
import TrashPage from "./pages/TrashPage";
import CollectionsPage from "./pages/CollectionsPage";
import CollectionDetailPage from "./pages/CollectionDetailPage";
import { CrawlManagement } from "./components/CrawlManagement";
import ManageSuppliersPage from "./pages/ManageSuppliersPage";
import ManageColleaguesPage from "./pages/ManageColleaguesPage";
import { UserManagement } from "./components/UserManagement";
import { ActivityLog } from "./components/ActivityLog";
import AnalyticsPage from "./pages/AnalyticsPage";

const queryClient = new QueryClient();

// Protected route wrapper with approval check
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isApproved, profile } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile === null && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (!isApproved) {
    return <Navigate to="/pending" replace />;
  }
  
  return <>{children}</>;
}

// Pending route wrapper
function PendingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isApproved, profile } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile === null && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (isApproved) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/pending" element={<PendingRoute><PendingApproval /></PendingRoute>} />
    
    {/* Protected routes with AppLayout */}
    <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route index element={<Navigate to="/discover" replace />} />
      <Route path="discover" element={<DiscoverPage />} />
      <Route path="positive" element={<PositiveListPage />} />
      <Route path="negative" element={<NegativeListPage />} />
      <Route path="suppliers" element={<SuppliersPage />} />
      <Route path="trash" element={<TrashPage />} />
      <Route path="collections" element={<CollectionsPage />} />
      <Route path="collections/:id" element={<CollectionDetailPage />} />
      <Route path="crawl" element={<CrawlManagement />} />
      <Route path="manage-suppliers" element={<ManageSuppliersPage />} />
      <Route path="colleagues" element={<ManageColleaguesPage />} />
      <Route path="users" element={<UserManagement />} />
      <Route path="activity" element={<ActivityLog />} />
      <Route path="analytics" element={<AnalyticsPage />} />
    </Route>
    
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
