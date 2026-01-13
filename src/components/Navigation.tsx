import { Layers, ThumbsUp, ThumbsDown, Package, Settings, Filter, LogOut, ChevronDown, Globe, Users, UserPlus, ShieldCheck, Activity, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

type View = "swipe" | "positive" | "negative" | "suppliers" | "crawl" | "supplier-management" | "colleague-management" | "user-management" | "activity-log" | "collections";

interface NavigationProps {
  currentView: View;
  onViewChange: (view: View) => void;
  positiveCount: number;
  negativeCount: number;
  pendingCount: number;
  selectedCompetitor: string;
  onCompetitorChange: (competitor: string) => void;
  competitors: string[];
}

export const Navigation = ({
  currentView,
  onViewChange,
  positiveCount,
  negativeCount,
  pendingCount,
  selectedCompetitor,
  onCompetitorChange,
  competitors,
}: NavigationProps) => {
  const { signOut, isAdmin } = useAuth();
  
  const mainNavItems: { id: View; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: "swipe",
      label: "Discover",
      icon: <Layers className="h-5 w-5" />,
      count: pendingCount,
    },
    {
      id: "positive",
      label: "Positive",
      icon: <ThumbsUp className="h-5 w-5" />,
      count: positiveCount,
    },
    {
      id: "negative",
      label: "Negative",
      icon: <ThumbsDown className="h-5 w-5" />,
      count: negativeCount,
    },
    {
      id: "suppliers",
      label: "Suppliers",
      icon: <Package className="h-5 w-5" />,
    },
  ];

  const settingsItems: { id: View; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    {
      id: "crawl",
      label: "Crawl Competitors",
      icon: <Globe className="h-4 w-4" />,
    },
    {
      id: "supplier-management",
      label: "Manage Suppliers",
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "colleague-management",
      label: "Manage Colleagues",
      icon: <UserPlus className="h-4 w-4" />,
    },
    {
      id: "collections",
      label: "Collections",
      icon: <FolderOpen className="h-4 w-4" />,
    },
    {
      id: "activity-log",
      label: "Activity Log",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      id: "user-management",
      label: "Manage Users",
      icon: <ShieldCheck className="h-4 w-4" />,
      adminOnly: true,
    },
  ];

  const filteredSettingsItems = settingsItems.filter(item => !item.adminOnly || isAdmin);
  const isSettingsView = currentView === "crawl" || currentView === "supplier-management" || currentView === "colleague-management" || currentView === "user-management" || currentView === "activity-log" || currentView === "collections";

  return (
    <>
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="FashionSpyder" className="h-10 w-auto" />
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden items-center gap-1 md:flex">
            {mainNavItems.map((item) => (
              <Button
                key={item.id}
                variant={currentView === item.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onViewChange(item.id)}
                className="gap-2"
              >
                {item.icon}
                {item.label}
                {item.count !== undefined && item.count > 0 && (
                  <Badge
                    variant={currentView === item.id ? "default" : "secondary"}
                    className="ml-1 h-5 min-w-5 px-1.5"
                  >
                    {item.count}
                  </Badge>
                )}
              </Button>
            ))}
            
            {/* Settings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={isSettingsView ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {filteredSettingsItems.map((item, index) => (
                  <div key={item.id}>
                    {item.adminOnly && index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => onViewChange(item.id)}
                      className="gap-2"
                    >
                      {item.icon}
                      {item.label}
                      {item.adminOnly && (
                        <Badge variant="outline" className="ml-auto text-xs">Admin</Badge>
                      )}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Filter and Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCompetitor} onValueChange={onCompetitorChange}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {competitors.map((competitor) => (
                    <SelectItem key={competitor} value={competitor}>
                      {competitor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile Filter Row */}
        <div className="flex items-center justify-center gap-2 border-t px-4 py-2 md:hidden">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCompetitor} onValueChange={onCompetitorChange}>
            <SelectTrigger className="h-9 flex-1 max-w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {competitors.map((competitor) => (
                <SelectItem key={competitor} value={competitor}>
                  {competitor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Mobile Bottom Navigation - Fixed at bottom */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg md:hidden safe-area-inset-bottom">
        <div className="flex h-16">
          {mainNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <Button
                key={item.id}
                variant="ghost"
                onClick={() => onViewChange(item.id)}
                className={`flex-1 flex-col gap-1 rounded-none h-full px-1 ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {item.count !== undefined && item.count > 0 && (
                    <span className="absolute -right-3 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground shadow-sm">
                      {item.count > 99 ? "99+" : item.count}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] font-medium ${isActive ? "text-primary" : ""}`}>
                  {item.label}
                </span>
              </Button>
            );
          })}
          
          {/* Settings in bottom nav */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={`flex-1 flex-col gap-1 rounded-none h-full px-1 ${
                  isSettingsView 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground"
                }`}
              >
                <Settings className="h-5 w-5" />
                <span className={`text-[11px] font-medium ${isSettingsView ? "text-primary" : ""}`}>
                  Settings
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              {filteredSettingsItems.map((item, index) => (
                <div key={item.id}>
                  {item.adminOnly && index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => onViewChange(item.id)}
                    className="gap-2"
                  >
                    {item.icon}
                    {item.label}
                    {item.adminOnly && (
                      <Badge variant="outline" className="ml-auto text-xs">Admin</Badge>
                    )}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </>
  );
};

export default Navigation;
