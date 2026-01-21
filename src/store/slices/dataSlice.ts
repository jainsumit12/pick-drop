import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ShiftDriver, ShiftPassenger } from '../../types/transport';
import { SHIFT_TYPES, ShiftType } from '../../constants/shifts';

interface RouteData {
  drivers: ShiftDriver[];
  passengers: ShiftPassenger[];
  lastFetched: string | null;
}

type ShiftData = Record<ShiftType, RouteData>;

interface DateEntry {
  going: ShiftData;
  return: ShiftData;
}

type DateMap = Record<string, DateEntry>;

interface DataState {
  byDate: DateMap;
}

const createEmptyRouteData = (): RouteData => ({
  drivers: [],
  passengers: [],
  lastFetched: null,
});

const createEmptyShiftData = (): ShiftData =>
  SHIFT_TYPES.reduce<ShiftData>((acc, shift) => {
    acc[shift] = createEmptyRouteData();
    return acc;
  }, {} as ShiftData);

const ensureDateEntry = (map: DateMap, date: string): DateEntry => {
  if (!map[date]) {
    map[date] = {
      going: createEmptyShiftData(),
      return: createEmptyShiftData(),
    };
  }
  return map[date];
};

const initialState: DataState = {
  byDate: {},
};

type RouteType = 'going' | 'return';

interface SaveDataPayload {
  routeType: RouteType;
  shift: ShiftType;
  date: string;
  drivers: ShiftDriver[];
  passengers: ShiftPassenger[];
}

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    saveRouteData: (state, action: PayloadAction<SaveDataPayload>) => {
      const { routeType, shift, date, drivers, passengers } = action.payload;
      const entry = ensureDateEntry(state.byDate, date);
      entry[routeType][shift] = {
        drivers,
        passengers,
        lastFetched: new Date().toISOString(),
      };
    },
    clearRouteData: (
      state,
      action: PayloadAction<{ routeType: RouteType; shift: ShiftType; date: string }>
    ) => {
      const { routeType, shift, date } = action.payload;
      const entry = state.byDate[date];
      if (entry) {
        entry[routeType][shift] = createEmptyRouteData();
      }
    },
    clearAllData: (state) => {
      state.byDate = {};
    },
  },
});

export const { saveRouteData, clearRouteData, clearAllData } = dataSlice.actions;
export default dataSlice.reducer;
