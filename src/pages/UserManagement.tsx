import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Key, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  roles: string[];
  createdAt: string;
}

const UserManagement = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Eroare",
          description: "Nu ești autentificat",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('list-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error loading users:', error);
        toast({
          title: "Eroare",
          description: "Nu s-au putut încărca utilizatorii",
          variant: "destructive",
        });
        return;
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca utilizatorii",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast({
        title: "Eroare",
        description: "Introdu o parolă nouă",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Eroare",
        description: "Parola trebuie să aibă cel puțin 6 caractere",
        variant: "destructive",
      });
      return;
    }

    try {
      setResetting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Eroare",
          description: "Nu ești autentificat",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: selectedUser.id,
          newPassword: newPassword,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error resetting password:', error);
        toast({
          title: "Eroare",
          description: "Nu s-a putut reseta parola",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succes",
        description: `Parola pentru ${selectedUser.username} a fost resetată`,
      });

      setResetDialogOpen(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut reseta parola",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-6">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">Gestionare Utilizatori</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadUsers}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Reîmprospătează
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Deconectare
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <Card className="shadow-custom-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Toți Utilizatorii
                    </CardTitle>
                    <CardDescription>Gestionează parolele și rolurile utilizatorilor</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    {users.length} utilizatori
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Se încarcă utilizatorii...
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nu există utilizatori
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Nume Complet</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Roluri</TableHead>
                        <TableHead className="text-right">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {user.roles.map((role) => (
                                <Badge 
                                  key={role} 
                                  variant={role === 'admin' ? 'default' : 'secondary'}
                                >
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog open={resetDialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                              setResetDialogOpen(open);
                              if (!open) {
                                setSelectedUser(null);
                                setNewPassword('');
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setResetDialogOpen(true);
                                  }}
                                  className="gap-2"
                                >
                                  <Key className="h-4 w-4" />
                                  Resetează Parolă
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Resetează Parola</DialogTitle>
                                  <DialogDescription>
                                    Setează o parolă nouă pentru {user.username} ({user.fullName})
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="new-password">Parola Nouă</Label>
                                    <Input
                                      id="new-password"
                                      type="text"
                                      placeholder="Introdu parola nouă"
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      autoComplete="off"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                      Parola trebuie să aibă cel puțin 6 caractere
                                    </p>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setResetDialogOpen(false);
                                      setSelectedUser(null);
                                      setNewPassword('');
                                    }}
                                  >
                                    Anulează
                                  </Button>
                                  <Button 
                                    onClick={handleResetPassword}
                                    disabled={resetting || !newPassword || newPassword.length < 6}
                                  >
                                    {resetting ? 'Se resetează...' : 'Resetează Parola'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default UserManagement;
