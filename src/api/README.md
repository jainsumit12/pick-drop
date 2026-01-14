# API Integration Guide

This directory contains the API integration setup using Axios with interceptors for the Route Planner application.

## Structure

```
src/api/
├── axios.ts                    # Axios instance with interceptors
├── services/
│   ├── auth.service.ts        # Authentication API calls
│   ├── routes.service.ts      # Routes API calls
│   ├── drivers.service.ts     # Drivers & Passengers API calls
│   └── index.ts               # Service exports
└── index.ts                    # Main API exports
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### Axios Instance

The axios instance is pre-configured with:
- Base URL from environment variables
- 10-second timeout
- JSON content type headers
- Request/Response interceptors

## Features

### Request Interceptor
- Automatically adds JWT token from Redux store to all requests
- Logs requests in development mode
- Handles request errors

### Response Interceptor
- Logs responses in development mode
- Handles common HTTP errors (401, 403, 404, 500)
- Automatically redirects to login on 401 Unauthorized
- Returns formatted error messages

## Usage

### Importing Services

```typescript
import { authService, routesService, driversService, passengersService } from '@/api';
```

### Authentication

```typescript
// Login
try {
  const response = await authService.login({
    username: 'admin',
    password: 'admin123'
  });
  console.log('User:', response.user);
} catch (error) {
  console.error('Login failed:', error);
}

// Get current user
const user = await authService.getCurrentUser();

// Logout
await authService.logout();
```

### Routes Management

```typescript
// Get all routes
const { routes, total } = await routesService.getAllRoutes(1, 50);

// Create new route
const newRoute = await routesService.createRoute({
  name: 'Morning Route 1',
  driverId: 'driver-123',
  passengerIds: ['pass-1', 'pass-2'],
  routeInfo: {
    distance: 15.5,
    duration: 25,
    route: routeData
  },
  color: { primary: '#3b82f6', name: 'blue' },
  routeType: 'going'
});

// Update route
await routesService.updateRoute({
  id: 'route-123',
  name: 'Updated Route Name'
});

// Delete route
await routesService.deleteRoute('route-123');

// Get routes by type
const goingRoutes = await routesService.getRoutesByType('going');

// Export routes
const blob = await routesService.exportRoutes(['route-1', 'route-2']);
```

### Drivers & Passengers

```typescript
// Get all drivers
const drivers = await driversService.getAllDrivers();

// Get drivers by shift
const morningDrivers = await driversService.getDriversByShift('Morning');

// Create new driver
const newDriver = await driversService.createDriver({
  DRIVER_ID: 'D001',
  SHIFT: 'Morning',
  DATE: '2026-01-01',
  TIME: '06:00:00',
  DRIVER_NAME: 'John Doe',
  DRIVER_PHONE: '1234567890',
  HOME_LOCATION: 'Address Here',
  DRIVER_SUBPOINT: 'Subpoint',
  HOME_LAT: 43.4484726,
  HOME_LOG: -80.3080245
});

// Similar operations for passengers
const passengers = await passengersService.getAllPassengers();
const passengersByShift = await passengersService.getPassengersByShift('Evening');
```

## Error Handling

All API calls return Promises and should be wrapped in try-catch blocks:

```typescript
try {
  const data = await routesService.getAllRoutes();
  // Handle success
} catch (error: any) {
  console.error('Error:', error.message);
  // Handle error
  // error.status - HTTP status code
  // error.message - Error message
  // error.data - Additional error data
}
```

## Using with React Query (Optional)

For better data management, you can integrate React Query:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { routesService } from '@/api';

// Fetch routes
const { data, isLoading, error } = useQuery({
  queryKey: ['routes'],
  queryFn: () => routesService.getAllRoutes()
});

// Create route mutation
const createRouteMutation = useMutation({
  mutationFn: routesService.createRoute,
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['routes'] });
  }
});
```

## Direct Axios Usage

If you need to make custom API calls:

```typescript
import { axiosInstance } from '@/api';

const response = await axiosInstance.get('/custom-endpoint');
const data = await axiosInstance.post('/custom-endpoint', { data: 'value' });
```

## Testing

Mock the services in your tests:

```typescript
jest.mock('@/api', () => ({
  routesService: {
    getAllRoutes: jest.fn().mockResolvedValue({ routes: [], total: 0 })
  }
}));
```

## Notes

- All requests automatically include the JWT token from Redux store
- Tokens are stored in Redux auth state under `user.token`
- 401 errors trigger automatic redirect to login page
- Network errors are caught and formatted
- Development mode includes console logging for debugging
