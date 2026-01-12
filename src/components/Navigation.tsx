import { Layers, ThumbsUp, ThumbsDown, Package, Settings, Filter, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logo from "@/assets/logo.png";

type View = "swipe" | "positive" | "negative" | "suppliers" | "crawl" | "settings";

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
  const navItems: { id: View; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: "swipe",
      label: "Discover",
      icon: <Layers className="h-4 w-4" />,
      count: pendingCount,
    },
    {
      id: "positive",
      label: "Positive",
      icon: <ThumbsUp className="h-4 w-4" />,
      count: positiveCount,
    },
    {
      id: "negative",
      label: "Negative",
      icon: <ThumbsDown className="h-4 w-4" />,
      count: negativeCount,
    },
    {
      id: "suppliers",
      label: "Suppliers",
      icon: <Package className="h-4 w-4" />,
    },
    {
      id: "crawl",
      label: "Crawl",
      icon: <Globe className="h-4 w-4" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src={logo} alt="FashionSpyder" className="h-10 w-auto" />
        </div>

        {/* Nav Items */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
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
        </nav>

        {/* Filter */}
        <div className="flex items-center gap-2">
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
      </div>

      {/* Mobile Nav */}
      <nav className="flex border-t md:hidden">
        {navItems.slice(0, 4).map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            onClick={() => onViewChange(item.id)}
            className={`flex-1 flex-col gap-1 rounded-none py-3 ${
              currentView === item.id ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <div className="relative">
              {item.icon}
              {item.count !== undefined && item.count > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                  {item.count}
                </span>
              )}
            </div>
            <span className="text-xs">{item.label}</span>
          </Button>
        ))}
      </nav>
    </header>
  );
};

export default Navigation;