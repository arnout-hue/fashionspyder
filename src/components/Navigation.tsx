import { Layers, ThumbsUp, ThumbsDown, Package, Settings, Filter, LogOut, ChevronDown, Globe, Users, UserPlus, ShieldCheck, Activity, FolderOpen, Trash2, BarChart3 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
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

interface NavigationProps {
  positiveCount: number;
  negativeCount: number;
  pendingCount: number;
  trashCount: number;
  selectedCompetitor: string;
  onCompetitorChange: (competitor: string) => void;
  competitors: string[];
}

export const Navigation = ({
  positiveCount,
  negativeCount,
  pendingCount,
  trashCount,
  selectedCompetitor,
  onCompetitorChange,
  competitors,
}: NavigationProps) => {
  const { signOut, isAdmin } = useAuth();
  const location = useLocation();
  
  const mainNavItems: { path: string; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      path: "/discover",
      label: "Discover",
      icon: <Layers className="h-5 w-5" />,
      count: pendingCount,
    },
    {
      path: "/positive",
      label: "Positive",
      icon: <ThumbsUp className="h-5 w-5" />,
      count: positiveCount,
    },
    {
      path: "/negative",
      label: "Negative",
      icon: <ThumbsDown className="h-5 w-5" />,
      count: negativeCount,
    },
    {
      path: "/suppliers",
      label: "Suppliers",
      icon: <Package className="h-5 w-5" />,
    },
  ];

  const settingsItems: { path: string; label: string; icon: React.ReactNode; adminOnly?: boolean; count?: number }[] = [
    {
      path: "/analytics",
      label: "Analytics",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      path: "/crawl",
      label: "Crawl Competitors",
      icon: <Globe className="h-4 w-4" />,
    },
    {
      path: "/manage-suppliers",
      label: "Manage Suppliers",
      icon: <Users className="h-4 w-4" />,
    },
    {
      path: "/colleagues",
      label: "Manage Colleagues",
      icon: <UserPlus className="h-4 w-4" />,
    },
    {
      path: "/collections",
      label: "Collections",
      icon: <FolderOpen className="h-4 w-4" />,
    },
    {
      path: "/trash",
      label: "Trash",
      icon: <Trash2 className="h-4 w-4" />,
      count: trashCount,
    },
    {
      path: "/activity",
      label: "Activity Log",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      path: "/users",
      label: "Manage Users",
      icon: <ShieldCheck className="h-4 w-4" />,
      adminOnly: true,
    },
  ];

  const filteredSettingsItems = settingsItems.filter(item => !item.adminOnly || isAdmin);
  const settingsPaths = settingsItems.map(i => i.path);
  const isSettingsView = settingsPaths.some(path => location.pathname.startsWith(path));

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <>
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/discover" className="flex items-center gap-2">
            <img src={logo} alt="FashionSpyder" className="h-10 w-auto" />
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden items-center gap-1 md:flex">
            {mainNavItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? "secondary" : "ghost"}
                size="sm"
                asChild
                className="gap-2"
              >
                <Link to={item.path}>
                  {item.icon}
                  {item.label}
                  {item.count !== undefined && item.count > 0 && (
                    <Badge
                      variant={isActive(item.path) ? "default" : "secondary"}
                      className="ml-1 h-5 min-w-5 px-1.5"
                    >
                      {item.count}
                    </Badge>
                  )}
                </Link>
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
                  <div key={item.path}>
                    {item.adminOnly && index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem asChild className="gap-2">
                      <Link to={item.path}>
                        {item.icon}
                        {item.label}
                        {item.count !== undefined && item.count > 0 && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {item.count}
                          </Badge>
                        )}
                        {item.adminOnly && (
                          <Badge variant="outline" className="ml-auto text-xs">Admin</Badge>
                        )}
                      </Link>
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
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 flex flex-col items-center justify-center gap-1 h-full px-1 ${
                  active 
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
                <span className={`text-[11px] font-medium ${active ? "text-primary" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          {/* Settings in bottom nav */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex-1 flex flex-col items-center justify-center gap-1 h-full px-1 ${
                  isSettingsView 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground"
                }`}
              >
                <Settings className="h-5 w-5" />
                <span className={`text-[11px] font-medium ${isSettingsView ? "text-primary" : ""}`}>
                  Settings
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              {filteredSettingsItems.map((item, index) => (
                <div key={item.path}>
                  {item.adminOnly && index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem asChild className="gap-2">
                    <Link to={item.path}>
                      {item.icon}
                      {item.label}
                      {item.count !== undefined && item.count > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.count}
                        </Badge>
                      )}
                      {item.adminOnly && (
                        <Badge variant="outline" className="ml-auto text-xs">Admin</Badge>
                      )}
                    </Link>
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
