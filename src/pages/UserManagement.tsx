import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Key, LogOut, RefreshCw, Search, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AdminSearchCommand } from "@/components/AdminSearchCommand";

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
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
      setFilteredUsers(data.users || []);
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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user =>
      user.username?.toLowerCase().includes(query) ||
      user.fullName?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.roles.some(role => role.toLowerCase().includes(query))
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

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
      <div className="flex min-h-screen w-full bg-gradient-to-br from-background via-background to-muted/20">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border/50 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60 px-6 shadow-sm">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Gestionare Utilizatori
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <AdminSearchCommand />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadUsers}
                disabled={loading}
                className="gap-2 hover:bg-accent transition-all"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Reîmprospătează</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Deconectare</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <Card className="shadow-elegant border-primary/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-glass opacity-30 pointer-events-none" />
              <CardHeader className="relative">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Users className="h-6 w-6 text-primary" />
                      Toți Utilizatorii
                    </CardTitle>
                    <CardDescription className="mt-1">Gestionează parolele și rolurile utilizatorilor</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-2 shadow-md">
                    {filteredUsers.length} utilizatori
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3 mt-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Caută după nume, email sau rol..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background/50 border-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filtre
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="relative">
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
                    <p>Se încarcă utilizatorii...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>{searchQuery ? 'Nu s-au găsit utilizatori' : 'Nu există utilizatori'}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Username</TableHead>
                          <TableHead className="font-semibold">Nume Complet</TableHead>
                          <TableHead className="font-semibold">Email</TableHead>
                          <TableHead className="font-semibold">Roluri</TableHead>
                          <TableHead className="text-right font-semibold">Acțiuni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id} className="hover:bg-accent/30 transition-colors">
                            <TableCell className="font-medium">{user.username}</TableCell>
                            <TableCell>{user.fullName}</TableCell>
                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {user.roles.map((role) => (
                                  <Badge 
                                    key={role} 
                                    variant={role === 'admin' ? 'default' : 'secondary'}
                                    className="shadow-sm"
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
                                    className="gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary transition-all"
                                  >
                                    <Key className="h-4 w-4" />
                                    Resetează Parolă
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
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
                                        className="border-primary/20 focus:border-primary"
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
                                      className="bg-gradient-primary shadow-md hover:shadow-lg transition-all"
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
                  </div>
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
