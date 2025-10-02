import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Key, LogOut, RefreshCw, Search, Filter, UserPlus, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AdminSearchCommand } from "@/components/AdminSearchCommand";
import { MobileTableCard, MobileTableRow } from "@/components/MobileTableCard";
import { ResponsiveHeader } from "@/components/ResponsiveHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  
  // Add user dialog
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'employee'>('employee');
  const [creating, setCreating] = useState(false);

  // Edit user dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete user dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleAddUser = async () => {
    if (!newUsername || !newFirstName || !newLastName || !newUserPassword) {
      toast({
        title: "Eroare",
        description: "Completează toate câmpurile",
        variant: "destructive",
      });
      return;
    }

    if (newUserPassword.length < 6) {
      toast({
        title: "Eroare",
        description: "Parola trebuie să aibă cel puțin 6 caractere",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Eroare",
          description: "Nu ești autentificat",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('create-user', {
        body: {
          username: newUsername,
          firstName: newFirstName,
          lastName: newLastName,
          password: newUserPassword,
          role: newUserRole,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error creating user:', error);
        toast({
          title: "Eroare",
          description: "Nu s-a putut crea utilizatorul",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succes",
        description: `Utilizatorul ${newUsername} a fost creat cu succes`,
      });

      setAddUserDialogOpen(false);
      setNewUsername('');
      setNewFirstName('');
      setNewLastName('');
      setNewUserPassword('');
      setNewUserRole('employee');
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut crea utilizatorul",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !editFirstName || !editLastName) {
      toast({
        title: "Eroare",
        description: "Completează toate câmpurile",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdating(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Eroare",
          description: "Nu ești autentificat",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('update-user', {
        body: {
          userId: editingUser.id,
          firstName: editFirstName,
          lastName: editLastName,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error updating user:', error);
        toast({
          title: "Eroare",
          description: "Nu s-a putut actualiza utilizatorul",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succes",
        description: `Utilizatorul ${editingUser.username} a fost actualizat`,
      });

      setEditDialogOpen(false);
      setEditingUser(null);
      setEditFirstName('');
      setEditLastName('');
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza utilizatorul",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

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

  const handleDeleteUser = async () => {
    if (!deletingUser) {
      return;
    }

    try {
      setDeleting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Eroare",
          description: "Nu ești autentificat",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: deletingUser.id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error deleting user:', error);
        toast({
          title: "Eroare",
          description: "Nu s-a putut șterge utilizatorul",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succes",
        description: `Utilizatorul ${deletingUser.username} a fost șters`,
      });

      setDeleteDialogOpen(false);
      setDeletingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge utilizatorul",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-background via-background to-muted/20">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <ResponsiveHeader title="Gestionare Utilizatori" showSearch>
            <div className="hidden md:block">
              <AdminSearchCommand />
            </div>
            <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm"
                  className="gap-2 bg-gradient-primary shadow-md hover:shadow-lg transition-all h-9"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden md:inline">Adaugă Utilizator</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Adaugă Utilizator Nou</DialogTitle>
                  <DialogDescription>
                    Creează un cont nou pentru un angajat sau administrator
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-username">Username *</Label>
                    <Input
                      id="new-username"
                      placeholder="ex: ionpopescu"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="border-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="new-firstname">Prenume *</Label>
                      <Input
                        id="new-firstname"
                        placeholder="Prenume"
                        value={newFirstName}
                        onChange={(e) => setNewFirstName(e.target.value)}
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-lastname">Nume *</Label>
                      <Input
                        id="new-lastname"
                        placeholder="Nume"
                        value={newLastName}
                        onChange={(e) => setNewLastName(e.target.value)}
                        className="border-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-password">Parolă *</Label>
                    <Input
                      id="new-user-password"
                      type="text"
                      placeholder="Minim 6 caractere"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      autoComplete="off"
                      className="border-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-role">Rol *</Label>
                    <Select value={newUserRole} onValueChange={(value: 'admin' | 'employee') => setNewUserRole(value)}>
                      <SelectTrigger className="border-primary/20 focus:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Angajat</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddUserDialogOpen(false);
                      setNewUsername('');
                      setNewFirstName('');
                      setNewLastName('');
                      setNewUserPassword('');
                      setNewUserRole('employee');
                    }}
                    className="w-full sm:w-auto"
                  >
                    Anulează
                  </Button>
                  <Button 
                    onClick={handleAddUser}
                    disabled={creating || !newUsername || !newFirstName || !newLastName || !newUserPassword}
                    className="w-full sm:w-auto bg-gradient-primary shadow-md hover:shadow-lg transition-all"
                  >
                    {creating ? 'Se creează...' : 'Creează Utilizator'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadUsers}
              disabled={loading}
              className="gap-2 hover:bg-accent transition-all h-9 px-2 md:px-3"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Reîmprospătează</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={signOut}
              className="hidden md:flex gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all"
            >
              <LogOut className="h-4 w-4" />
              Deconectare
            </Button>
          </ResponsiveHeader>

          <main className="flex-1 overflow-y-auto p-3 md:p-6">
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
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Caută după nume, email sau rol..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background/50 border-primary/20 focus:border-primary transition-all h-10"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 h-10 whitespace-nowrap">
                    <Filter className="h-4 w-4" />
                    <span className="hidden sm:inline">Filtre</span>
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
                  <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block rounded-lg border border-border/50 overflow-hidden">
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
                                <div className="flex gap-2 justify-end">
                                  <Dialog open={editDialogOpen && editingUser?.id === user.id} onOpenChange={(open) => {
                                    setEditDialogOpen(open);
                                    if (!open) {
                                      setEditingUser(null);
                                      setEditFirstName('');
                                      setEditLastName('');
                                    }
                                  }}>
                                    <DialogTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => {
                                          setEditingUser(user);
                                          const names = user.fullName.split(' ');
                                          setEditFirstName(names.slice(0, -1).join(' ') || '');
                                          setEditLastName(names[names.length - 1] || '');
                                          setEditDialogOpen(true);
                                        }}
                                        className="gap-2 hover:bg-accent/50 transition-all"
                                      >
                                        <Edit className="h-4 w-4" />
                                        Editează
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Editează Utilizator</DialogTitle>
                                        <DialogDescription>
                                          Actualizează numele și prenumele pentru {user.username}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-2">
                                            <Label htmlFor="edit-firstname">Prenume *</Label>
                                            <Input
                                              id="edit-firstname"
                                              placeholder="Prenume"
                                              value={editFirstName}
                                              onChange={(e) => setEditFirstName(e.target.value)}
                                              className="border-primary/20 focus:border-primary"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label htmlFor="edit-lastname">Nume *</Label>
                                            <Input
                                              id="edit-lastname"
                                              placeholder="Nume"
                                              value={editLastName}
                                              onChange={(e) => setEditLastName(e.target.value)}
                                              className="border-primary/20 focus:border-primary"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <Button
                                          variant="outline"
                                          onClick={() => {
                                            setEditDialogOpen(false);
                                            setEditingUser(null);
                                            setEditFirstName('');
                                            setEditLastName('');
                                          }}
                                        >
                                          Anulează
                                        </Button>
                                        <Button 
                                          onClick={handleUpdateUser}
                                          disabled={updating || !editFirstName || !editLastName}
                                          className="bg-gradient-primary shadow-md hover:shadow-lg transition-all"
                                        >
                                          {updating ? 'Se actualizează...' : 'Salvează'}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
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
                              <Dialog open={deleteDialogOpen && deletingUser?.id === user.id} onOpenChange={(open) => {
                                setDeleteDialogOpen(open);
                                if (!open) {
                                  setDeletingUser(null);
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setDeletingUser(user);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Șterge
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Șterge Utilizator</DialogTitle>
                                    <DialogDescription>
                                      Ești sigur că vrei să ștergi utilizatorul {user.username} ({user.fullName})?
                                      Această acțiune este permanentă și nu poate fi anulată.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setDeleteDialogOpen(false);
                                        setDeletingUser(null);
                                      }}
                                    >
                                      Anulează
                                    </Button>
                                    <Button 
                                      onClick={handleDeleteUser}
                                      disabled={deleting}
                                      variant="destructive"
                                      className="shadow-md hover:shadow-lg transition-all"
                                    >
                                      {deleting ? 'Se șterge...' : 'Șterge Definitiv'}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden space-y-3">
                      {filteredUsers.map((user) => (
                        <MobileTableCard key={user.id}>
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-base">{user.username}</div>
                                <div className="text-sm text-muted-foreground mt-0.5">{user.fullName}</div>
                              </div>
                              <div className="flex gap-1 flex-wrap justify-end ml-2">
                                {user.roles.map((role) => (
                                  <Badge 
                                    key={role} 
                                    variant={role === 'admin' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <MobileTableRow 
                              label="Email" 
                              value={<span className="text-muted-foreground text-xs break-all">{user.email}</span>}
                              fullWidth
                            />
                            
                            <div className="flex gap-2">
                              <Dialog open={editDialogOpen && editingUser?.id === user.id} onOpenChange={(open) => {
                                setEditDialogOpen(open);
                                if (!open) {
                                  setEditingUser(null);
                                  setEditFirstName('');
                                  setEditLastName('');
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setEditingUser(user);
                                      const names = user.fullName.split(' ');
                                      setEditFirstName(names.slice(0, -1).join(' ') || '');
                                      setEditLastName(names[names.length - 1] || '');
                                      setEditDialogOpen(true);
                                    }}
                                    className="flex-1 gap-2 hover:bg-accent/50 transition-all touch-target"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Editează
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Editează Utilizator</DialogTitle>
                                    <DialogDescription>
                                      Actualizează numele și prenumele pentru {user.username}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-firstname-mobile">Prenume *</Label>
                                        <Input
                                          id="edit-firstname-mobile"
                                          placeholder="Prenume"
                                          value={editFirstName}
                                          onChange={(e) => setEditFirstName(e.target.value)}
                                          className="border-primary/20 focus:border-primary"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-lastname-mobile">Nume *</Label>
                                        <Input
                                          id="edit-lastname-mobile"
                                          placeholder="Nume"
                                          value={editLastName}
                                          onChange={(e) => setEditLastName(e.target.value)}
                                          className="border-primary/20 focus:border-primary"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <DialogFooter className="flex-col sm:flex-row gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setEditDialogOpen(false);
                                        setEditingUser(null);
                                        setEditFirstName('');
                                        setEditLastName('');
                                      }}
                                      className="w-full sm:w-auto"
                                    >
                                      Anulează
                                    </Button>
                                    <Button 
                                      onClick={handleUpdateUser}
                                      disabled={updating || !editFirstName || !editLastName}
                                      className="w-full sm:w-auto bg-gradient-primary shadow-md hover:shadow-lg transition-all"
                                    >
                                      {updating ? 'Se actualizează...' : 'Salvează'}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            
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
                                  className="flex-1 gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary transition-all touch-target"
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
                                <DialogFooter className="flex-col sm:flex-row gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setResetDialogOpen(false);
                                      setSelectedUser(null);
                                      setNewPassword('');
                                    }}
                                    className="w-full sm:w-auto"
                                  >
                                    Anulează
                                  </Button>
                                  <Button 
                                    onClick={handleResetPassword}
                                    disabled={resetting || !newPassword || newPassword.length < 6}
                                    className="w-full sm:w-auto bg-gradient-primary shadow-md hover:shadow-lg transition-all"
                                  >
                                    {resetting ? 'Se resetează...' : 'Resetează Parola'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            
                            <Dialog open={deleteDialogOpen && deletingUser?.id === user.id} onOpenChange={(open) => {
                              setDeleteDialogOpen(open);
                              if (!open) {
                                setDeletingUser(null);
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setDeletingUser(user);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="flex-1 gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-all touch-target"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Șterge
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Șterge Utilizator</DialogTitle>
                                  <DialogDescription>
                                    Ești sigur că vrei să ștergi utilizatorul {user.username} ({user.fullName})?
                                    Această acțiune este permanentă și nu poate fi anulată.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="flex-col sm:flex-row gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setDeleteDialogOpen(false);
                                      setDeletingUser(null);
                                    }}
                                    className="w-full sm:w-auto"
                                  >
                                    Anulează
                                  </Button>
                                  <Button 
                                    onClick={handleDeleteUser}
                                    disabled={deleting}
                                    variant="destructive"
                                    className="w-full sm:w-auto shadow-md hover:shadow-lg transition-all"
                                  >
                                    {deleting ? 'Se șterge...' : 'Șterge Definitiv'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            </div>
                          </div>
                        </MobileTableCard>
                      ))}
                    </div>
                  </>
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
