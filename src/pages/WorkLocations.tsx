import { useState, useEffect, useRef } from "react";
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
import { MapPin, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AdminLayout } from "@/components/AdminLayout";
import { getCurrentPosition } from "@/lib/geolocation";

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
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(false);
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

  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [tokenReady, setTokenReady] = useState(false);
  const [mapError, setMapError] = useState<string>('');

  // Load token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('mapboxPublicToken') || MAPBOX_TOKEN;
    console.log('[Mapbox] Token loaded:', {
      hasToken: !!token,
      tokenLength: token?.length,
      isValid: token?.startsWith('pk.'),
      source: localStorage.getItem('mapboxPublicToken') ? 'localStorage' : 'default',
    });
    setMapboxToken(token);
    setTokenReady(true);
  }, []);

  // Save token to localStorage when it changes
  useEffect(() => {
    if (tokenReady && mapboxToken) {
      localStorage.setItem('mapboxPublicToken', mapboxToken);
      console.log('[Mapbox] Token saved to localStorage');
    }
  }, [mapboxToken, tokenReady]);

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

    // Don't initialize map until token is ready
    if (!tokenReady) {
      console.log('[Mapbox] Waiting for token to be ready...');
      return;
    }

    if (!mapContainer.current || map.current) return;

    const token = mapboxToken || MAPBOX_TOKEN;
    console.log('[Mapbox] Initializing map with token:', {
      hasToken: !!token,
      tokenLength: token?.length,
      isValid: token?.startsWith('pk.'),
    });

    // Wait for DOM to be ready and dialog animation to complete
    const initTimer = setTimeout(() => {
      if (!mapContainer.current) return;

      try {
        mapboxgl.accessToken = token;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [formData.longitude, formData.latitude],
          zoom: 12,
        });

        console.log('[Mapbox] Map initialized successfully');

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Ensure proper sizing after dialog opens
        map.current.on('load', () => {
          console.log('[Mapbox] Map loaded');
          // Force resize twice for reliability
          setTimeout(() => {
            map.current?.resize();
          }, 100);
          setTimeout(() => {
            map.current?.resize();
          }, 300);
          setMapError('');
        });

        // Surface Mapbox errors (e.g., invalid token)
        map.current.on('error', (e) => {
          console.error('[Mapbox] Error:', e);
          setMapError('Eroare Mapbox: verificați tokenul public sau permisiunile domeniului.');
        });

        // Update formData when map is clicked
        map.current.on('click', (e) => {
          console.log('[Mapbox] Map clicked:', { lat: e.lngLat.lat, lng: e.lngLat.lng });
          setFormData((prev) => ({
            ...prev,
            latitude: e.lngLat.lat,
            longitude: e.lngLat.lng,
          }));
        });
      } catch (error) {
        console.error('[Mapbox] Init failed:', error);
        setMapError('Eroare inițializare hartă. Verificați token-ul.');
      }
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [dialogOpen, tokenReady, mapboxToken]);

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

  const useCurrentLocation = async () => {
    setLoadingLocation(true);
    console.log('[Geolocation] Getting current position...');
    
    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maxRetries: 2,
        retryDelay: 1000,
      });

      const { latitude, longitude } = position.coords;
      console.log('[Geolocation] Position obtained:', { latitude, longitude, accuracy: position.coords.accuracy });
      
      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));
      
      // Centrare harta pe locația curentă
      if (map.current) {
        map.current.flyTo({
          center: [longitude, latitude],
          zoom: 15,
          duration: 1500,
        });
      }
      
      toast.success(`Locație obținută! (±${Math.round(position.coords.accuracy)}m)`);
    } catch (error: any) {
      console.error('[Geolocation] Error:', error);
      let errorMessage = 'Nu s-a putut obține locația';
      
      if (error.message) {
        if (error.message.includes('denied')) {
          errorMessage = 'Permisiunea de localizare a fost refuzată. Verificați setările browser-ului.';
        } else if (error.message.includes('unavailable')) {
          errorMessage = 'Serviciile de localizare nu sunt disponibile';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Timpul de așteptare a expirat. Încercați din nou.';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoadingLocation(false);
    }
  };

  return (
    <AdminLayout 
      title="Locații de Lucru"
      actions={
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
                        <div className="flex items-center justify-between">
                          <Label>Hartă (Click pentru a selecta locația)</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={useCurrentLocation}
                            disabled={loadingLocation}
                            className="gap-2"
                          >
                            {loadingLocation ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Se obține...
                              </>
                            ) : (
                              <>
                                <MapPin className="h-4 w-4" />
                                Locația Mea
                              </>
                            )}
                          </Button>
                        </div>
                        {mapError && (
                          <p className="text-sm text-destructive">{mapError}</p>
                        )}
                        {!tokenReady && (
                          <p className="text-sm text-muted-foreground">Se încarcă token-ul...</p>
                        )}
                        <Input
                          id="mapbox-token"
                          placeholder="Token Mapbox public (pk...); lasă gol pentru tokenul implicit"
                          value={mapboxToken}
                          onChange={(e) => setMapboxToken(e.target.value)}
                          className="mb-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          Token-ul se salvează automat și se aplică imediat.
                        </p>
                        <div ref={mapContainer} className="h-[300px] rounded-lg border bg-muted relative">
                          {!tokenReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          💡 Click pe hartă pentru a seta locația sau folosește butonul "Locația Mea"
                        </p>
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
      }
    >
      <div className="p-6">
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
      </div>
    </AdminLayout>
  );
};

export default WorkLocations;
