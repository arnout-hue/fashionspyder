import { Clock, LogOut, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';

export default function PendingApproval() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="FashionSpyder" className="h-12 w-auto" />
          </div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
          <CardDescription className="mt-2">
            Your account is awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Mail className="h-4 w-4" />
              <span className="font-medium">{profile?.email}</span>
            </div>
            <p>
              An administrator will review your account request shortly. 
              You'll receive access once your account has been approved.
            </p>
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Registered as:</p>
            <p className="font-medium text-foreground">{profile?.full_name || profile?.email}</p>
            <p className="text-xs">
              Account created: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
            </p>
          </div>

          <Button 
            variant="outline" 
            onClick={signOut}
            className="w-full gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
