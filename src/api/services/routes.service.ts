import axiosInstance from '../axios';
import { SavedRoute } from '../../types/route';

interface CreateRouteData {
  name: string;
  driverId: string;
  passengerIds: string[];
  routeInfo: {
    distance: number;
    duration: number;
    route: any;
  };
  color: { primary: string; name: string };
  routeType: 'going' | 'return' | 'pickup';
}

interface UpdateRouteData extends Partial<CreateRouteData> {
  id: string;
}

interface RouteListResponse {
  routes: SavedRoute[];
  total: number;
  page: number;
  limit: number;
}

export const routesService = {
  // Get all routes
  getAllRoutes: async (page = 1, limit = 50): Promise<RouteListResponse> => {
    const response = await axiosInstance.get<RouteListResponse>('/routes', {
      params: { page, limit },
    });
    return response.data;
  },

  // Get route by ID
  getRouteById: async (id: string): Promise<SavedRoute> => {
    const response = await axiosInstance.get<SavedRoute>(`/routes/${id}`);
    return response.data;
  },

  // Create new route
  createRoute: async (data: CreateRouteData): Promise<SavedRoute> => {
    const response = await axiosInstance.post<SavedRoute>('/routes', data);
    return response.data;
  },

  // Update route
  updateRoute: async (data: UpdateRouteData): Promise<SavedRoute> => {
    const { id, ...updateData } = data;
    const response = await axiosInstance.put<SavedRoute>(`/routes/${id}`, updateData);
    return response.data;
  },

  // Delete route
  deleteRoute: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/routes/${id}`);
  },

  // Toggle route visibility
  toggleRouteVisibility: async (id: string): Promise<SavedRoute> => {
    const response = await axiosInstance.patch<SavedRoute>(`/routes/${id}/visibility`);
    return response.data;
  },

  // Get routes by type
  getRoutesByType: async (type: 'going' | 'return' | 'pickup'): Promise<SavedRoute[]> => {
    const response = await axiosInstance.get<SavedRoute[]>('/routes', {
      params: { type },
    });
    return response.data;
  },

  // Get routes by driver
  getRoutesByDriver: async (driverId: string): Promise<SavedRoute[]> => {
    const response = await axiosInstance.get<SavedRoute[]>(`/routes/driver/${driverId}`);
    return response.data;
  },

  // Export routes to Excel
  exportRoutes: async (routeIds: string[]): Promise<Blob> => {
    const response = await axiosInstance.post(
      '/routes/export',
      { routeIds },
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },
};
