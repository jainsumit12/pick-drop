import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface RouteFilters {
  selectedDate: string;
  selectedShift: string;
}

interface FilterState {
  going: RouteFilters;
  return: RouteFilters;
}

const getInitialDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

const initialState: FilterState = {
  going: {
    selectedDate: getInitialDate(),
    selectedShift: 'Morning',
  },
  return: {
    selectedDate: getInitialDate(),
    selectedShift: 'Morning',
  },
};

const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setGoingDate: (state, action: PayloadAction<string>) => {
      state.going.selectedDate = action.payload;
    },
    setGoingShift: (state, action: PayloadAction<string>) => {
      state.going.selectedShift = action.payload;
    },
    setReturnDate: (state, action: PayloadAction<string>) => {
      state.return.selectedDate = action.payload;
    },
    setReturnShift: (state, action: PayloadAction<string>) => {
      state.return.selectedShift = action.payload;
    },
    resetGoingFilters: (state) => {
      state.going.selectedDate = getInitialDate();
      state.going.selectedShift = 'Morning';
    },
    resetReturnFilters: (state) => {
      state.return.selectedDate = getInitialDate();
      state.return.selectedShift = 'Morning';
    },
    resetAllFilters: (state) => {
      state.going.selectedDate = getInitialDate();
      state.going.selectedShift = 'Morning';
      state.return.selectedDate = getInitialDate();
      state.return.selectedShift = 'Morning';
    },
  },
});

export const {
  setGoingDate,
  setGoingShift,
  setReturnDate,
  setReturnShift,
  resetGoingFilters,
  resetReturnFilters,
  resetAllFilters,
} = filterSlice.actions;
export default filterSlice.reducer;
