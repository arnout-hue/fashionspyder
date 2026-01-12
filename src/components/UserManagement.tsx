import { useState, useEffect } from 'react';
import { Check, X, Shield, Edit2, UserCheck, UserX, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole, Profile } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      toast.error('Failed to load users');
      setLoading(false);
      return;
    }

    // Fetch all roles
    const { data: allRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');
    
    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Combine profiles with roles
    const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
      ...profile as Profile,
      roles: (allRoles || [])
        .filter(r => r.user_id === profile.id)
        .map(r => r.role as AppRole)
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const pendingUsers = users.filter(u => !u.is_approved && !u.rejected_at);
  const approvedUsers = users.filter(u => u.is_approved);
  const rejectedUsers = users.filter(u => u.rejected_at && !u.is_approved);

  const handleApprove = async (userId: string, withRoles: AppRole[] = ['viewer']) => {
    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_approved: true,
        approved_by: currentUser?.id,
        approved_at: new Date().toISOString(),
        rejected_at: null,
        rejection_reason: null
      })
      .eq('id', userId);

    if (profileError) {
      toast.error('Failed to approve user');
      console.error('Error approving user:', profileError);
      return;
    }

    // Add roles
    for (const role of withRoles) {
      await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role,
          granted_by: currentUser?.id
        }, { onConflict: 'user_id,role' });
    }

    toast.success('User approved');
    fetchUsers();
  };

  const handleReject = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_approved: false,
        rejected_at: new Date().toISOString(),
        rejection_reason: 'Account request denied by administrator'
      })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to reject user');
      console.error('Error rejecting user:', error);
      return;
    }

    // Remove all roles
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    toast.success('User rejected');
    fetchUsers();
  };

  const handleUpdateRoles = async () => {
    if (!editingUser) return;

    // Get current roles
    const currentRoles = editingUser.roles;
    
    // Roles to add
    const rolesToAdd = selectedRoles.filter(r => !currentRoles.includes(r));
    
    // Roles to remove
    const rolesToRemove = currentRoles.filter(r => !selectedRoles.includes(r));

    // Add new roles
    for (const role of rolesToAdd) {
      await supabase
        .from('user_roles')
        .insert({
          user_id: editingUser.id,
          role,
          granted_by: currentUser?.id
        });
    }

    // Remove roles
    for (const role of rolesToRemove) {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id)
        .eq('role', role);
    }

    toast.success('Roles updated');
    setEditingUser(null);
    fetchUsers();
  };

  const openRoleEditor = (user: UserWithRoles) => {
    setEditingUser(user);
    setSelectedRoles(user.roles);
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'editor': return 'default';
      case 'viewer': return 'secondary';
    }
  };

  const UserCard = ({ user, showActions = true }: { user: UserWithRoles; showActions?: boolean }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium truncate">{user.full_name || 'No name'}</span>
              {user.id === currentUser?.id && (
                <Badge variant="outline" className="text-xs">You</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {user.roles.length > 0 ? (
                user.roles.map(role => (
                  <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                    {role}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-xs">No roles</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Joined: {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
          
          {showActions && user.id !== currentUser?.id && (
            <div className="flex gap-2">
              {!user.is_approved && !user.rejected_at && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(user.id)}
                    className="gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(user.id)}
                    className="gap-1"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}
              {user.is_approved && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openRoleEditor(user)}
                  className="gap-1"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Roles
                </Button>
              )}
              {user.rejected_at && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApprove(user.id)}
                  className="gap-1"
                >
                  <UserCheck className="h-4 w-4" />
                  Re-approve
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold flex items-center gap-3">
          <Shield className="h-8 w-8" />
          User Management
        </h1>
        <p className="mt-2 text-muted-foreground">
          Approve new accounts, manage roles and permissions
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {pendingUsers.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingUsers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Active
            <Badge variant="secondary" className="ml-1">{approvedUsers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <UserX className="h-4 w-4" />
            Rejected
            {rejectedUsers.length > 0 && (
              <Badge variant="secondary" className="ml-1">{rejectedUsers.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingUsers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending approval requests</p>
              </CardContent>
            </Card>
          ) : (
            pendingUsers.map(user => (
              <UserCard key={user.id} user={user} />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved">
          {approvedUsers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active users</p>
              </CardContent>
            </Card>
          ) : (
            approvedUsers.map(user => (
              <UserCard key={user.id} user={user} />
            ))
          )}
        </TabsContent>

        <TabsContent value="rejected">
          {rejectedUsers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rejected users</p>
              </CardContent>
            </Card>
          ) : (
            rejectedUsers.map(user => (
              <UserCard key={user.id} user={user} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Roles Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
            <DialogDescription>
              Assign roles to {editingUser?.full_name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="role-admin"
                checked={selectedRoles.includes('admin')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedRoles(prev => [...prev, 'admin']);
                  } else {
                    setSelectedRoles(prev => prev.filter(r => r !== 'admin'));
                  }
                }}
              />
              <div>
                <Label htmlFor="role-admin" className="font-medium">Admin</Label>
                <p className="text-sm text-muted-foreground">Full access - manage users, settings, and all data</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="role-editor"
                checked={selectedRoles.includes('editor')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedRoles(prev => [...prev, 'editor']);
                  } else {
                    setSelectedRoles(prev => prev.filter(r => r !== 'editor'));
                  }
                }}
              />
              <div>
                <Label htmlFor="role-editor" className="font-medium">Editor</Label>
                <p className="text-sm text-muted-foreground">Can swipe products, manage suppliers and colleagues, run crawls</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="role-viewer"
                checked={selectedRoles.includes('viewer')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedRoles(prev => [...prev, 'viewer']);
                  } else {
                    setSelectedRoles(prev => prev.filter(r => r !== 'viewer'));
                  }
                }}
              />
              <div>
                <Label htmlFor="role-viewer" className="font-medium">Viewer</Label>
                <p className="text-sm text-muted-foreground">Read-only access to view products and lists</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRoles}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
