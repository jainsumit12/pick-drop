import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SavedRoute } from '../../types/route';

interface RoutesState {
  savedRoutes: SavedRoute[];
  pendingGoingRoutes: SavedRoute[];
  pendingReturnRoutes: SavedRoute[];
}

const initialState: RoutesState = {
  savedRoutes: [],
  pendingGoingRoutes: [],
  pendingReturnRoutes: [],
};

const routesSlice = createSlice({
  name: 'routes',
  initialState,
  reducers: {
    addRoute: (state, action: PayloadAction<SavedRoute>) => {
      state.savedRoutes.push(action.payload);
    },
    deleteRoute: (state, action: PayloadAction<string>) => {
      state.savedRoutes = state.savedRoutes.filter(route => route.id !== action.payload);
    },
    toggleRouteVisibility: (state, action: PayloadAction<string>) => {
      const route = state.savedRoutes.find(r => r.id === action.payload);
      if (route) {
        route.visible = !route.visible;
      }
    },
    clearAllRoutes: (state) => {
      state.savedRoutes = [];
    },
    clearRoutesByType: (state, action: PayloadAction<'going' | 'return'>) => {
      state.savedRoutes = state.savedRoutes.filter(route => route.routeType !== action.payload);
    },
    addPendingGoingRoute: (state, action: PayloadAction<SavedRoute>) => {
      if (!state.pendingGoingRoutes) state.pendingGoingRoutes = [];
      state.pendingGoingRoutes.push({ ...action.payload, visible: action.payload.visible ?? true });
    },
    removePendingGoingRoute: (state, action: PayloadAction<string>) => {
      state.pendingGoingRoutes = (state.pendingGoingRoutes || []).filter(r => r.id !== action.payload);
    },
    setPendingGoingRoutes: (state, action: PayloadAction<SavedRoute[]>) => {
      state.pendingGoingRoutes = action.payload;
    },
    clearPendingGoingRoutes: (state) => {
      state.pendingGoingRoutes = [];
    },
    togglePendingGoingRouteVisibility: (state, action: PayloadAction<string>) => {
      const route = (state.pendingGoingRoutes || []).find((r) => r.id === action.payload);
      if (route) {
        route.visible = !route.visible;
      }
    },
    addPendingReturnRoute: (state, action: PayloadAction<SavedRoute>) => {
      if (!state.pendingReturnRoutes) state.pendingReturnRoutes = [];
      state.pendingReturnRoutes.push({ ...action.payload, visible: action.payload.visible ?? true });
    },
    removePendingReturnRoute: (state, action: PayloadAction<string>) => {
      state.pendingReturnRoutes = (state.pendingReturnRoutes || []).filter(r => r.id !== action.payload);
    },
    setPendingReturnRoutes: (state, action: PayloadAction<SavedRoute[]>) => {
      state.pendingReturnRoutes = action.payload;
    },
    clearPendingReturnRoutes: (state) => {
      state.pendingReturnRoutes = [];
    },
    togglePendingReturnRouteVisibility: (state, action: PayloadAction<string>) => {
      const route = (state.pendingReturnRoutes || []).find((r) => r.id === action.payload);
      if (route) {
        route.visible = !route.visible;
      }
    },
  },
});

export const {
  addRoute,
  deleteRoute,
  toggleRouteVisibility,
  clearAllRoutes,
  clearRoutesByType,
  addPendingGoingRoute,
  removePendingGoingRoute,
  setPendingGoingRoutes,
  clearPendingGoingRoutes,
  togglePendingGoingRouteVisibility,
  addPendingReturnRoute,
  removePendingReturnRoute,
  setPendingReturnRoutes,
  clearPendingReturnRoutes,
  togglePendingReturnRouteVisibility,
} = routesSlice.actions;
export default routesSlice.reducer;
