import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { User, MapPin, Route, Trash2, Eye, EyeOff } from 'lucide-react';

// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoic2lkaHVkaGlsbG9udGVhbSIsImEiOiJjbTVwMm1mYXYwZ2k4MmtzMWhnbjQ1Z2E0In0.gK3s6yddFXNErt-IbgZ26g';

interface Location {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  type: 'driver' | 'passenger';
}

// Mock data - coordinates around Kitchener-Toronto, Ontario
const mockDrivers: Location[] = [
  { id: 'd1', name: 'Driver John', coordinates: [-80.4925, 43.4516], type: 'driver' }, // Kitchener
  { id: 'd2', name: 'Driver Sarah', coordinates: [-79.9, 43.55], type: 'driver' }, // Mississauga
  { id: 'd3', name: 'Driver Mike', coordinates: [-79.3832, 43.6532], type: 'driver' }, // Toronto Downtown
];

const mockPassengers: Location[] = [
  { id: 'p1', name: 'Alice Johnson', coordinates: [-80.52, 43.47], type: 'passenger' }, // Waterloo
  { id: 'p2', name: 'Bob Smith', coordinates: [-80.25, 43.52], type: 'passenger' }, // Guelph
  { id: 'p3', name: 'Carol Williams', coordinates: [-79.76, 43.68], type: 'passenger' }, // Brampton
  { id: 'p4', name: 'David Brown', coordinates: [-79.42, 43.70], type: 'passenger' }, // North York
  { id: 'p5', name: 'Eva Martinez', coordinates: [-79.50, 43.60], type: 'passenger' }, // Etobicoke
];

interface RouteInfo {
  distance: number; // in kilometers
  duration: number; // in minutes
  route: any;
}

interface SavedRoute {
  id: string;
  name: string;
  driverId: string;
  passengerIds: string[];
  routeInfo: RouteInfo;
  color: { primary: string; name: string };
  visible: boolean;
}

export function MapboxRouteApp() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeColorIndex, setRouteColorIndex] = useState(0);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [showCurrentSelection, setShowCurrentSelection] = useState(true);

  // Route colors that cycle through different selections
  const routeColors = [
    { primary: '#3b82f6', name: 'Blue' },      // Blue
    { primary: '#8b5cf6', name: 'Purple' },    // Purple
    { primary: '#ec4899', name: 'Pink' },      // Pink
    { primary: '#f59e0b', name: 'Orange' },    // Orange
    { primary: '#10b981', name: 'Green' },     // Green
  ];

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-79.9, 43.55], // Center between Kitchener and Toronto
        zoom: 9,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Wait for map to load before adding markers
      map.current.on('load', () => {
        console.log('Map loaded successfully');
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers and route when selections change
  useEffect(() => {
    if (!map.current) return;

    // Wait for map to be loaded
    if (!map.current.isStyleLoaded()) {
      map.current.once('load', () => {
        updateMarkersAndRoute();
      });
      return;
    }

    updateMarkersAndRoute();
  }, [selectedDriver, selectedPassengers, showCurrentSelection]);

  // Render all saved routes on map
  useEffect(() => {
    if (!map.current) return;

    // Wait for map to be loaded
    if (!map.current.isStyleLoaded()) {
      map.current.once('load', () => {
        renderSavedRoutes();
      });
      return;
    }

    renderSavedRoutes();
  }, [savedRoutes]);

  const renderSavedRoutes = () => {
    if (!map.current) return;

    // Remove all existing saved route layers and sources
    savedRoutes.forEach((route) => {
      const layerId = `saved-route-${route.id}`;
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
      if (map.current!.getSource(layerId)) {
        map.current!.removeSource(layerId);
      }
    });

    // Add visible saved routes to map
    savedRoutes.forEach((route) => {
      if (!route.visible) return;

      const layerId = `saved-route-${route.id}`;
      
      if (!map.current!.getSource(layerId)) {
        map.current!.addSource(layerId, {
          type: 'geojson',
          data: route.routeInfo.route
        });

        map.current!.addLayer({
          id: layerId,
          type: 'line',
          source: layerId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': route.color.primary,
            'line-width': 4,
            'line-opacity': 0.75
          }
        });
      }
    });
  };

  const updateMarkersAndRoute = () => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add driver markers
    mockDrivers.forEach(driver => {
      const isSelected = driver.id === selectedDriver;
      
      // Skip rendering selected driver if showCurrentSelection is false
      if (isSelected && !showCurrentSelection) return;
      
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isSelected ? '#3b82f6' : '#6b7280';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

      const marker = new mapboxgl.Marker(el)
        .setLngLat(driver.coordinates)
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>${driver.name}</strong><br/>Driver`))
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Add passenger markers
    mockPassengers.forEach(passenger => {
      const isSelected = selectedPassengers.includes(passenger.id);
      
      // Skip rendering selected passengers if showCurrentSelection is false
      if (isSelected && !showCurrentSelection) return;
      
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isSelected ? '#10b981' : '#9ca3af';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg>`;

      const marker = new mapboxgl.Marker(el)
        .setLngLat(passenger.coordinates)
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>${passenger.name}</strong><br/>Passenger`))
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Draw route if driver and at least one passenger are selected
    if (selectedDriver && selectedPassengers.length > 0) {
      calculateRoute();
    } else {
      // Remove route layer if exists
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
        map.current.removeSource('route');
      }
      setRouteInfo(null);
    }
  };

  const calculateRoute = async () => {
    if (!selectedDriver || selectedPassengers.length === 0 || !map.current) return;

    setIsCalculating(true);

    try {
      const driver = mockDrivers.find(d => d.id === selectedDriver);
      const passengers = mockPassengers.filter(p => selectedPassengers.includes(p.id));
      
      if (!driver) return;

      // Create waypoints: driver -> passengers
      const coordinates = [
        driver.coordinates,
        ...passengers.map(p => p.coordinates)
      ];

      // Use Mapbox Directions API
      const coordinatesStr = coordinates.map(c => c.join(',')).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesStr}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Calculate total distance and duration
        const distanceKm = route.distance / 1000; // Convert meters to km
        const durationMin = route.duration / 60; // Convert seconds to minutes

        setRouteInfo({
          distance: distanceKm,
          duration: durationMin,
          route: route.geometry
        });

        // Draw route on map
        if (map.current.getSource('route')) {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(route.geometry);
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: route.geometry
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': routeColors[routeColorIndex].primary,
              'line-width': 4,
              'line-opacity': 0.75
            }
          });
        }

        // Fit map to route bounds
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord as [number, number]));
        map.current.fitBounds(bounds, { padding: 50 });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const togglePassenger = (passengerId: string) => {
    setSelectedPassengers(prev =>
      prev.includes(passengerId)
        ? prev.filter(id => id !== passengerId)
        : [...prev, passengerId]
    );
  };

  const clearSelections = () => {
    setSelectedDriver(null);
    setSelectedPassengers([]);
    setRouteInfo(null);
  };

  const changeRouteColor = () => {
    const nextIndex = (routeColorIndex + 1) % routeColors.length;
    setRouteColorIndex(nextIndex);
    
    // Update route color if route exists
    if (map.current && map.current.getLayer('route')) {
      map.current.setPaintProperty('route', 'line-color', routeColors[nextIndex].primary);
    }
  };

  const saveRoute = () => {
    if (!selectedDriver || selectedPassengers.length === 0 || !routeInfo) return;

    const newRoute: SavedRoute = {
      id: `route-${Date.now()}`,
      name: `Route ${savedRoutes.length + 1}`,
      driverId: selectedDriver,
      passengerIds: selectedPassengers,
      routeInfo: routeInfo,
      color: routeColors[routeColorIndex],
      visible: true
    };

    setSavedRoutes(prev => [...prev, newRoute]);
  };

  const deleteRoute = (routeId: string) => {
    setSavedRoutes(prev => prev.filter(route => route.id !== routeId));
  };

  const toggleRouteVisibility = (routeId: string) => {
    setSavedRoutes(prev => prev.map(route => 
      route.id === routeId ? { ...route, visible: !route.visible } : route
    ));
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="bg-white border-b p-4 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Route Planner - Kitchener-Toronto</h1>
          </div>
          {(selectedDriver || selectedPassengers.length > 0) && (
            <Button variant="outline" onClick={clearSelections}>
              Clear Selections
            </Button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div className="w-96 bg-white border-r overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Drivers Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Select Driver
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {mockDrivers.map(driver => (
                  <div
                    key={driver.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedDriver === driver.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedDriver(driver.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${selectedDriver === driver.id ? 'bg-blue-500' : 'bg-gray-400'}`} />
                        <span className="font-medium">{driver.name}</span>
                      </div>
                      <Badge variant={selectedDriver === driver.id ? 'default' : 'secondary'}>
                        Driver
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Passengers Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Select Passengers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {mockPassengers.map(passenger => (
                  <div
                    key={passenger.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedPassengers.includes(passenger.id)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => togglePassenger(passenger.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedPassengers.includes(passenger.id)}
                          onCheckedChange={() => togglePassenger(passenger.id)}
                        />
                        <span className="font-medium">{passenger.name}</span>
                      </div>
                      <Badge variant={selectedPassengers.includes(passenger.id) ? 'default' : 'secondary'}>
                        Passenger
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Route Info */}
            {routeInfo && (
              <Card className="bg-gradient-to-br from-blue-50 to-green-50">
                <CardHeader>
                  <CardTitle className="text-lg">Route Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="text-gray-600">Total Distance</span>
                    <span className="font-bold text-lg text-blue-600">
                      {routeInfo.distance.toFixed(2)} km
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="text-gray-600">Estimated Time</span>
                    <span className="font-bold text-lg text-green-600">
                      {Math.round(routeInfo.duration)} min
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Route Summary</div>
                    <div className="text-sm">
                      <span className="font-medium">{selectedDriver && mockDrivers.find(d => d.id === selectedDriver)?.name}</span>
                      {' → '}
                      <span className="font-medium">{selectedPassengers.length} passenger(s)</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={changeRouteColor}
                  >
                    Change Route Color ({routeColors[routeColorIndex].name})
                  </Button>
                  <Button 
                    className="w-full mt-2" 
                    variant="outline"
                    onClick={saveRoute}
                  >
                    Save Route
                  </Button>
                </CardContent>
              </Card>
            )}

            {isCalculating && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">Calculating route...</p>
              </div>
            )}

            {/* Saved Routes */}
            {savedRoutes.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Saved Routes ({savedRoutes.length})</CardTitle>
                    {(selectedDriver || selectedPassengers.length > 0) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowCurrentSelection(!showCurrentSelection)}
                        className="flex items-center gap-1"
                      >
                        {showCurrentSelection ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span className="text-xs">{showCurrentSelection ? 'Hide' : 'Show'} Selection</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">{savedRoutes.map(route => {
                    const driver = mockDrivers.find(d => d.id === route.driverId);
                    return (
                      <div
                        key={route.id}
                        className={`p-3 rounded-lg border-2 transition-colors ${
                          route.visible ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              style={{ 
                                width: '16px', 
                                height: '4px', 
                                backgroundColor: route.color.primary,
                                borderRadius: '2px'
                              }}
                            />
                            <span className="font-medium">{route.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRouteVisibility(route.id);
                              }}
                            >
                              {route.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRoute(route.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>Driver: {driver?.name}</div>
                          <div>Passengers: {route.passengerIds.length}</div>
                          <div className="flex items-center justify-between">
                            <span>{route.routeInfo.distance.toFixed(1)} km</span>
                            <span>{Math.round(route.routeInfo.duration)} min</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div 
            ref={mapContainer} 
            style={{ 
              position: 'absolute', 
              top: 0, 
              bottom: 0, 
              left: 0, 
              right: 0,
              width: '100%',
              height: '100%'
            }} 
          />
          
          {/* Map Instructions Overlay */}
          {!selectedDriver && selectedPassengers.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'white',
              padding: '12px 24px',
              borderRadius: '9999px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              zIndex: 10
            }}>
              <p className="text-sm text-gray-600">
                Select a driver and passengers to see the route
              </p>
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            backgroundColor: 'white',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 10
          }}>
            <h3 className="font-semibold mb-2">Legend</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  border: '2px solid white'
                }}></div>
                <span>Selected Driver</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#6b7280',
                  border: '2px solid white'
                }}></div>
                <span>Unselected Driver</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '1px solid white'
                }}></div>
                <span>Selected Passenger</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#9ca3af',
                  border: '1px solid white'
                }}></div>
                <span>Unselected Passenger</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{
                  width: '32px',
                  height: '2px',
                  backgroundColor: routeColors[routeColorIndex].primary
                }}></div>
                <span>Route ({routeColors[routeColorIndex].name})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
