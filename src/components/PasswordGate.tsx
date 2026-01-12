import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import logo from "@/assets/logo.png";

const CORRECT_PASSWORD = "FMHSPYDER2026!";
const STORAGE_KEY = "fmh_app_authenticated";

interface PasswordGateProps {
  children: React.ReactNode;
}

export const PasswordGate = ({ children }: PasswordGateProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    const authenticated = sessionStorage.getItem(STORAGE_KEY);
    if (authenticated === "true") {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setIsAuthenticated(true);
    } else {
      setError("Incorrect password");
      setPassword("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse">
          <img src={logo} alt="Loading" className="h-16 w-auto opacity-50" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src={logo} alt="FashionSpyder" className="mb-4 h-20 w-auto" />
          <h1 className="font-display text-2xl font-semibold">FashionSpyder</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PasswordGate;
