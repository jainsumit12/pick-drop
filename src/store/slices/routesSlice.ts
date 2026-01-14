import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SavedRoute } from '../../types/route';

interface RoutesState {
  savedRoutes: SavedRoute[];
}

const initialState: RoutesState = {
  savedRoutes: [],
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
  },
});

export const { addRoute, deleteRoute, toggleRouteVisibility, clearAllRoutes } = routesSlice.actions;
export default routesSlice.reducer;
