/**
 * Example component showing how to use API services
 * This is for reference only - not meant to be used in production
 */

import { useState, useEffect } from 'react';
import { authService, routesService, driversService, passengersService } from '../services';
import { SavedRoute } from '../../types/route';
import { useAppDispatch } from '../../store/hooks';
import { login } from '../../store/slices/authSlice';

export function ApiUsageExample() {
  const dispatch = useAppDispatch();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authService.login({
        username: 'admin',
        password: 'admin123',
      });

      dispatch(login(response.user));

      console.log('Login successful:', response);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 2: Fetch all routes
  const fetchRoutes = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await routesService.getAllRoutes(1, 50);
      setRoutes(response.routes);

      console.log('Routes fetched:', response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch routes');
      console.error('Fetch routes error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 3: Create new route
  const handleCreateRoute = async () => {
    try {
      setLoading(true);
      setError(null);

      const newRoute = await routesService.createRoute({
        name: 'Morning Route 1',
        driverId: 'driver-123',
        passengerIds: ['pass-1', 'pass-2', 'pass-3'],
        routeInfo: {
          distance: 15.5,
          duration: 25,
          route: {}, // Route geometry data
        },
        color: { primary: '#3b82f6', name: 'blue' },
        routeType: 'going',
      });

      console.log('Route created:', newRoute);

      // Refresh routes list
      await fetchRoutes();
    } catch (err: any) {
      setError(err.message || 'Failed to create route');
      console.error('Create route error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 4: Update route
  const handleUpdateRoute = async (routeId: string) => {
    try {
      setLoading(true);
      setError(null);

      const updatedRoute = await routesService.updateRoute({
        id: routeId,
        name: 'Updated Route Name',
      });

      console.log('Route updated:', updatedRoute);

      // Refresh routes list
      await fetchRoutes();
    } catch (err: any) {
      setError(err.message || 'Failed to update route');
      console.error('Update route error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 5: Delete route
  const handleDeleteRoute = async (routeId: string) => {
    try {
      setLoading(true);
      setError(null);

      await routesService.deleteRoute(routeId);
      console.log('Route deleted');

      // Refresh routes list
      await fetchRoutes();
    } catch (err: any) {
      setError(err.message || 'Failed to delete route');
      console.error('Delete route error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 6: Fetch drivers
  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);



      const morningDrivers = await driversService.getDriversByShift('2024-06-15', 'route-1', 'Morning');
      console.log('Morning drivers:', morningDrivers);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch drivers');
      console.error('Fetch drivers error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 7: Fetch passengers
  const fetchPassengers = async () => {
    try {
      setLoading(true);
      setError(null);

      const passengers = await passengersService.getAllPassengers();
      console.log('Passengers fetched:', passengers);

      // Get passengers by shift
      const eveningPassengers = await passengersService.getPassengersByShift('Evening');
      console.log('Evening passengers:', eveningPassengers);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch passengers');
      console.error('Fetch passengers error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 8: Get routes by type
  const fetchGoingRoutes = async () => {
    try {
      setLoading(true);
      setError(null);

      const goingRoutes = await routesService.getRoutesByType('going');
      console.log('Going routes:', goingRoutes);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch going routes');
      console.error('Fetch going routes error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 9: Export routes
  const handleExportRoutes = async (routeIds: string[]) => {
    try {
      setLoading(true);
      setError(null);

      const blob = await routesService.exportRoutes(routeIds);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `routes-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('Routes exported');
    } catch (err: any) {
      setError(err.message || 'Failed to export routes');
      console.error('Export routes error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Example 10: Using useEffect to fetch data on mount
  useEffect(() => {
    // Fetch routes when component mounts
    fetchRoutes();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">API Usage Examples</h1>

      {loading && <p className="text-blue-600">Loading...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      <div className="space-y-2">
        <button
          onClick={handleLogin}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={loading}
        >
          Login
        </button>

        <button
          onClick={fetchRoutes}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          disabled={loading}
        >
          Fetch Routes
        </button>

        <button
          onClick={handleCreateRoute}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          disabled={loading}
        >
          Create Route
        </button>

        <button
          onClick={fetchDrivers}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          disabled={loading}
        >
          Fetch Drivers
        </button>

        <button
          onClick={fetchPassengers}
          className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600"
          disabled={loading}
        >
          Fetch Passengers
        </button>

        <button
          onClick={fetchGoingRoutes}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          disabled={loading}
        >
          Fetch Going Routes
        </button>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Routes ({routes.length})</h2>
        <ul className="space-y-2">
          {routes.map((route) => (
            <li key={route.id} className="p-2 border rounded">
              <p className="font-medium">{route.name}</p>
              <p className="text-sm text-gray-600">
                Type: {route.routeType} | Distance: {route.routeInfo.distance}km
              </p>
              <div className="mt-2 space-x-2">
                <button
                  onClick={() => handleUpdateRoute(route.id)}
                  className="px-2 py-1 bg-blue-400 text-white rounded text-sm"
                  disabled={loading}
                >
                  Update
                </button>
                <button
                  onClick={() => handleDeleteRoute(route.id)}
                  className="px-2 py-1 bg-red-400 text-white rounded text-sm"
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ApiUsageExample;
