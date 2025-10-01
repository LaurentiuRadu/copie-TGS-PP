import { useState, useEffect, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Edit, Trash2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibGF1cmVudGl1cmFkdSIsImEiOiJjbWc4MGtpb2owMjYzMmtxdWRrZG50NnV2In0._eXA5o4wir9a25cJhvX5VQ';

interface WorkLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

const WorkLocations = () => {
  const { signOut } = useAuth();
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WorkLocation | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: 44.4268, // Bucharest default
    longitude: 26.1025,
    radius_meters: 100,
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    // Initialize or cleanup map based on dialog visibility
    if (!dialogOpen) {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      // Clear any markers when dialog closes
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      return;
    }

    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [formData.longitude, formData.latitude],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Ensure proper sizing after dialog opens
    map.current.on('load', () => {
      map.current?.resize();
    });

    // Update formData when map is clicked
    map.current.on('click', (e) => {
      setFormData((prev) => ({
        ...prev,
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      }));
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [dialogOpen]);

  // Update markers when locations or formData changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add markers for saved locations
    locations.forEach(location => {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center';
      el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.longitude, location.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<h3 class="font-bold">${location.name}</h3><p>${location.address || ''}</p>`)
        )
        .addTo(map.current!);

      markers.current.push(marker);

      // Add radius circle
      if (map.current?.getSource(`radius-${location.id}`)) {
        map.current.removeLayer(`radius-${location.id}`);
        map.current.removeSource(`radius-${location.id}`);
      }
    });

    // Add marker for current form location (when adding/editing)
    if (dialogOpen) {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 bg-destructive rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse';
      el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';

      const currentMarker = new mapboxgl.Marker(el)
        .setLngLat([formData.longitude, formData.latitude])
        .addTo(map.current!);

      markers.current.push(currentMarker);

      map.current.flyTo({
        center: [formData.longitude, formData.latitude],
        zoom: 15,
      });
    }
  }, [locations, formData, dialogOpen]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('work_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      toast.error('Eroare la încărcarea locațiilor: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('work_locations')
          .update({
            name: formData.name,
            address: formData.address,
            latitude: formData.latitude,
            longitude: formData.longitude,
            radius_meters: formData.radius_meters,
          })
          .eq('id', editingLocation.id);

        if (error) throw error;
        toast.success('Locație actualizată cu succes');
      } else {
        const { error } = await supabase
          .from('work_locations')
          .insert([formData]);

        if (error) throw error;
        toast.success('Locație adăugată cu succes');
      }

      setDialogOpen(false);
      resetForm();
      fetchLocations();
    } catch (error: any) {
      toast.error('Eroare: ' + error.message);
    }
  };

  const handleEdit = (location: WorkLocation) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address || '',
      latitude: location.latitude,
      longitude: location.longitude,
      radius_meters: location.radius_meters,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur vrei să ștergi această locație?')) return;

    try {
      const { error } = await supabase
        .from('work_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Locație ștearsă');
      fetchLocations();
    } catch (error: any) {
      toast.error('Eroare: ' + error.message);
    }
  };

  const toggleActive = async (location: WorkLocation) => {
    try {
      const { error } = await supabase
        .from('work_locations')
        .update({ is_active: !location.is_active })
        .eq('id', location.id);

      if (error) throw error;
      toast.success(location.is_active ? 'Locație dezactivată' : 'Locație activată');
      fetchLocations();
    } catch (error: any) {
      toast.error('Eroare: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      latitude: 44.4268,
      longitude: 26.1025,
      radius_meters: 100,
    });
    setEditingLocation(null);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-6">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">Locații de Lucru</h1>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-gradient-primary">
                    <Plus className="h-4 w-4" />
                    Adaugă Locație
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingLocation ? 'Editează Locația' : 'Adaugă Locație Nouă'}
                    </DialogTitle>
                    <DialogDescription>
                      Selectează locația pe hartă sau introdu coordonatele manual
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nume Locație *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ex: Birou Central"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address">Adresă</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Ex: Str. Exemplu, Nr. 123"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="latitude">Latitudine *</Label>
                          <Input
                            id="latitude"
                            type="number"
                            step="any"
                            value={formData.latitude}
                            onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="longitude">Longitudine *</Label>
                          <Input
                            id="longitude"
                            type="number"
                            step="any"
                            value={formData.longitude}
                            onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="radius">Rază Permisă (metri) *</Label>
                        <Input
                          id="radius"
                          type="number"
                          value={formData.radius_meters}
                          onChange={(e) => setFormData({ ...formData, radius_meters: parseInt(e.target.value) })}
                          min="10"
                          max="1000"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Angajații vor putea face pontaj doar în interiorul acestei raze
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Hartă (Click pentru a selecta locația)</Label>
                        <div ref={mapContainer} className="h-[300px] rounded-lg border" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Anulează
                      </Button>
                      <Button type="submit">
                        {editingLocation ? 'Actualizează' : 'Adaugă'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
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
                      <MapPin className="h-5 w-5" />
                      Locații de Lucru Configurate
                    </CardTitle>
                    <CardDescription>
                      Gestionează locațiile unde angajații pot face pontaj
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Se încarcă...</div>
                ) : locations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nu există locații configurate
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nume</TableHead>
                        <TableHead>Adresă</TableHead>
                        <TableHead>Coordonate</TableHead>
                        <TableHead>Rază</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell className="font-medium">{location.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {location.address || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                          </TableCell>
                          <TableCell>{location.radius_meters}m</TableCell>
                          <TableCell>
                            <Badge
                              variant={location.is_active ? 'default' : 'secondary'}
                              className="cursor-pointer"
                              onClick={() => toggleActive(location)}
                            >
                              {location.is_active ? 'Activ' : 'Inactiv'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(location)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(location.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

export default WorkLocations;
