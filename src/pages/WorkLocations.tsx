import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
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
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";
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
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WorkLocation | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: 44.4268, // Bucharest default
    longitude: 26.1025,
    radius_meters: 100,
  });

  const [mapboxToken, setMapboxToken] = useState<string>(() => {
    return localStorage.getItem('mapboxPublicToken') || '';
  });
  const [mapError, setMapError] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('mapboxPublicToken', mapboxToken);
  }, [mapboxToken]);

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

    // Try to center on user's location on open (silent, no toasts) when adding new
    if (!editingLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => {
          setFormData((prev) => ({ ...prev, latitude, longitude }));
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }

    if (!mapContainer.current || map.current) return;

    let initTimer: number | undefined;

    const startMap = () => {
      if (!mapContainer.current || map.current) return;

      mapboxgl.accessToken = mapboxToken || MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [formData.longitude, formData.latitude],
        zoom: 12,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Watchers/handles used for cleanup
      let io: IntersectionObserver | null = null;
      let resizeInterval: number | undefined = undefined;

      // Ensure proper sizing after dialog opens and during animations
      map.current.on('load', () => {
        // Multiple resizes to handle dialog open transition
        setTimeout(() => map.current?.resize(), 50);
        setTimeout(() => map.current?.resize(), 150);
        setTimeout(() => map.current?.resize(), 350);
        setTimeout(() => map.current?.resize(), 700);
        setMapError('');
      });

      // Also resize once map becomes idle
      map.current.once('idle', () => {
        map.current?.resize();
      });

      // Observe container size changes (e.g., dialog animations, window resize)
      if (mapContainer.current) {
        try {
          resizeObserver.current?.disconnect();
          resizeObserver.current = new ResizeObserver(() => {
            map.current?.resize();
          });
          resizeObserver.current.observe(mapContainer.current);
        } catch (e) {
          // ResizeObserver might be unavailable in very old browsers
          console.debug('ResizeObserver not available', e);
        }
      }

      // Additionally, trigger resize when the container actually becomes visible
      if (mapContainer.current && 'IntersectionObserver' in window) {
        io = new IntersectionObserver((entries) => {
          if (entries[0]?.isIntersecting) {
            map.current?.resize();
          }
        }, { threshold: 0.1 });
        io.observe(mapContainer.current);
      }

      // Safety: aggressively resize for the first few seconds to cover any transitions
      resizeInterval = window.setInterval(() => {
        map.current?.resize();
      }, 250);
      window.setTimeout(() => {
        if (resizeInterval) window.clearInterval(resizeInterval);
      }, 3000);

      // Surface Mapbox errors (e.g., invalid token)
      map.current.on('error', (ev) => {
        console.error('Mapbox error', ev);
        setMapError('Eroare Mapbox: verificați tokenul public sau permisiunile domeniului.');
      });

      // Update formData when map is clicked
      map.current.on('click', (e) => {
        setFormData((prev) => ({
          ...prev,
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng,
        }));
      });
    };

    const waitForVisible = (tries = 20) => {
      const el = mapContainer.current;
      if (!el) return;
      const { clientWidth, clientHeight } = el;
      if (clientWidth > 0 && clientHeight > 0) {
        startMap();
      } else if (tries > 0) {
        initTimer = window.setTimeout(() => waitForVisible(tries - 1), 100);
      } else {
        startMap();
      }
    };

    initTimer = window.setTimeout(() => waitForVisible(), 100);

    return () => {
      clearTimeout(initTimer);
      resizeObserver.current?.disconnect();
      resizeObserver.current = null;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [dialogOpen, mapboxToken]);

  // Helper function to create GeoJSON circle
  const createGeoJSONCircle = (center: [number, number], radiusInMeters: number) => {
    const points = 64;
    const coords = {
      latitude: center[1],
      longitude: center[0],
    };

    const km = radiusInMeters / 1000;
    const ret = [];
    const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);

    return {
      type: 'geojson' as const,
      data: {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ret],
        },
        properties: {},
      },
    };
  };

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
    });

    // Add marker and radius circle for current form location (when adding/editing)
    if (dialogOpen) {
      const addCurrentMarkerAndCircle = () => {
        const el = document.createElement('div');
        el.className = 'w-8 h-8 bg-destructive rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse';
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';

        const currentMarker = new mapboxgl.Marker(el)
          .setLngLat([formData.longitude, formData.latitude])
          .addTo(map.current!);

        markers.current.push(currentMarker);

        // Remove existing radius circle if it exists
        if (map.current!.getSource('current-radius')) {
          if (map.current!.getLayer('current-radius-fill')) {
            map.current!.removeLayer('current-radius-fill');
          }
          if (map.current!.getLayer('current-radius-outline')) {
            map.current!.removeLayer('current-radius-outline');
          }
          map.current!.removeSource('current-radius');
        }

        // Add radius circle
        const circleSource = createGeoJSONCircle(
          [formData.longitude, formData.latitude],
          formData.radius_meters
        );
        
        map.current!.addSource('current-radius', circleSource);
        
        map.current!.addLayer({
          id: 'current-radius-fill',
          type: 'fill',
          source: 'current-radius',
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.2,
          },
        });
        
        map.current!.addLayer({
          id: 'current-radius-outline',
          type: 'line',
          source: 'current-radius',
          paint: {
            'line-color': '#3b82f6',
            'line-width': 2,
          },
        });

        // Calculate appropriate zoom level based on radius
        let zoom = 15;
        if (formData.radius_meters > 10000) zoom = 10;
        else if (formData.radius_meters > 5000) zoom = 11;
        else if (formData.radius_meters > 2000) zoom = 12;
        else if (formData.radius_meters > 1000) zoom = 13;
        else if (formData.radius_meters > 500) zoom = 14;

        map.current!.flyTo({
          center: [formData.longitude, formData.latitude],
          zoom: zoom,
        });
      };

      if (map.current.isStyleLoaded()) {
        addCurrentMarkerAndCircle();
      } else {
        map.current.once('style.load', addCurrentMarkerAndCircle);
      }
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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalizarea nu este suportată de acest browser');
      return;
    }

    toast.info('Se obține locația...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
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
        
        toast.success('Locație obținută cu succes!');
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Nu s-a putut obține locația';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permisiunea de localizare a fost refuzată';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Informațiile de localizare nu sunt disponibile';
            break;
          case error.TIMEOUT:
            errorMessage = 'Cererea de localizare a expirat';
            break;
        }
        
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <AdminLayout title="Locații de Lucru">
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
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-gradient-primary-action text-primary-foreground shadow-md">
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
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
                          <Label className="shrink-0">Hartă</Label>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={useCurrentLocation}
                            className="gap-2 shrink-0 whitespace-nowrap w-full sm:w-auto"
                          >
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span className="inline shrink-0">Locația Mea</span>
                          </Button>
                        </div>
                        {mapError && (
                          <p className="text-sm text-destructive">{mapError}</p>
                        )}
                        <Input
                          id="mapbox-token"
                          placeholder="Token Mapbox public (pk...); lasă gol pentru tokenul implicit"
                          value={mapboxToken}
                          onChange={(e) => setMapboxToken(e.target.value)}
                          className="mb-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          Token-ul se salvează automat. Închide și redeschide dialogul pentru a aplica modificările.
                        </p>
                        <div ref={mapContainer} className="relative h-[300px] w-full rounded-lg border bg-muted overflow-hidden" />
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
                        <TableHead className="text-foreground font-semibold">Nume</TableHead>
                        <TableHead className="text-foreground font-semibold">Adresă</TableHead>
                        <TableHead className="text-foreground font-semibold">Coordonate</TableHead>
                        <TableHead className="text-foreground font-semibold">Rază</TableHead>
                        <TableHead className="text-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-right text-foreground font-semibold">Acțiuni</TableHead>
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
