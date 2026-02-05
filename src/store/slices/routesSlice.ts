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
      state.pendingGoingRoutes.push(action.payload);
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
    addPendingReturnRoute: (state, action: PayloadAction<SavedRoute>) => {
      if (!state.pendingReturnRoutes) state.pendingReturnRoutes = [];
      state.pendingReturnRoutes.push(action.payload);
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
  addPendingReturnRoute,
  removePendingReturnRoute,
  setPendingReturnRoutes,
  clearPendingReturnRoutes,
} = routesSlice.actions;
export default routesSlice.reducer;
