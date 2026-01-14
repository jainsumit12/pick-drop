# Mapbox Route Planner - Setup Instructions

## Getting Started

This application requires a Mapbox access token to function properly.

### Steps to Add Your Mapbox Token:

1. **Get a Mapbox Access Token:**
   - Go to [Mapbox](https://www.mapbox.com/)
   - Sign up for a free account (if you don't have one)
   - Navigate to your [Account Dashboard](https://account.mapbox.com/)
   - Copy your **Default Public Token**

2. **Add Token to the Application:**
   - Open `/src/app/components/MapboxRouteApp.tsx`
   - Find line 9: `mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN_HERE';`
   - Replace `'YOUR_MAPBOX_ACCESS_TOKEN_HERE'` with your actual Mapbox token
   - Example: `mapboxgl.accessToken = 'pk.eyJ1IjoieW91cnVzZXJuYW1lIiwi...';`

### Features:

- **Select Driver:** Click on any driver card to select them (blue highlight)
- **Select Passengers:** Click or check multiple passenger cards (green highlight)
- **View Route:** Once a driver and at least one passenger are selected, the route will automatically be calculated and displayed
- **Route Information:** View total distance (km) and estimated time (minutes) in the sidebar
- **Interactive Map:** 
  - Zoom and pan using mouse/trackpad
  - Click markers to see names
  - Route is drawn in blue connecting all selected points
  
### Map Legend:
- 🔵 Blue marker = Selected driver
- ⚫ Gray marker = Unselected driver
- 🟢 Green marker = Selected passenger
- ⚪ Light gray marker = Unselected passenger
- 📍 Blue line = Calculated route

### Mock Data:
The application uses mock coordinates around San Francisco. You can modify the coordinates in `/src/app/components/MapboxRouteApp.tsx` to use your own locations.

### Technology Stack:
- **Mapbox GL JS** - Interactive maps
- **React** - UI framework
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **Mapbox Directions API** - Route calculation
