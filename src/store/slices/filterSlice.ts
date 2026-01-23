import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface RouteFilters {
  selectedDate: string;
  selectedShift: string;
  selectedDriver: string | null;
  selectedPassengers: string[];
  pickupCityFilter: string;
  destinationCityFilter: string;
  timeFilter: string[];
  driverTimeFilter: string[];
  driverSearch: string;
  passengerSearch: string;
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
    selectedDriver: null,
    selectedPassengers: [],
    pickupCityFilter: 'All',
    destinationCityFilter: 'All',
    timeFilter: [],
    driverTimeFilter: [],
    driverSearch: '',
    passengerSearch: '',
  },
  return: {
    selectedDate: getInitialDate(),
    selectedShift: 'Morning',
    selectedDriver: null,
    selectedPassengers: [],
    pickupCityFilter: 'All',
    destinationCityFilter: 'All',
    timeFilter: [],
    driverTimeFilter: [],
    driverSearch: '',
    passengerSearch: '',
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
      state.going.selectedDriver = null;
      state.going.selectedPassengers = [];
      state.going.pickupCityFilter = 'All';
      state.going.destinationCityFilter = 'All';
      state.going.timeFilter = [];
      state.going.driverTimeFilter = [];
      state.going.driverSearch = '';
      state.going.passengerSearch = '';
    },
    resetReturnFilters: (state) => {
      state.return.selectedDate = getInitialDate();
      state.return.selectedShift = 'Morning';
      state.return.selectedDriver = null;
      state.return.selectedPassengers = [];
      state.return.pickupCityFilter = 'All';
      state.return.destinationCityFilter = 'All';
      state.return.timeFilter = [];
      state.return.driverTimeFilter = [];
      state.return.driverSearch = '';
      state.return.passengerSearch = '';
    },
    resetAllFilters: (state) => {
      state.going.selectedDate = getInitialDate();
      state.going.selectedShift = 'Morning';
      state.going.selectedDriver = null;
      state.going.selectedPassengers = [];
      state.going.pickupCityFilter = 'All';
      state.going.destinationCityFilter = 'All';
      state.going.timeFilter = [];
      state.going.driverTimeFilter = [];
      state.going.driverSearch = '';
      state.going.passengerSearch = '';
      state.return.selectedDate = getInitialDate();
      state.return.selectedShift = 'Morning';
      state.return.selectedDriver = null;
      state.return.selectedPassengers = [];
      state.return.pickupCityFilter = 'All';
      state.return.destinationCityFilter = 'All';
      state.return.timeFilter = [];
      state.return.driverTimeFilter = [];
      state.return.driverSearch = '';
      state.return.passengerSearch = '';
    },
    // Going route selection actions
    setGoingDriver: (state, action: PayloadAction<string | null>) => {
      state.going.selectedDriver = action.payload;
    },
    setGoingPassengers: (state, action: PayloadAction<string[]>) => {
      state.going.selectedPassengers = action.payload;
    },
    setGoingPickupCityFilter: (state, action: PayloadAction<string>) => {
      state.going.pickupCityFilter = action.payload;
    },
    setGoingDestinationCityFilter: (state, action: PayloadAction<string>) => {
      state.going.destinationCityFilter = action.payload;
    },
    setGoingTimeFilter: (state, action: PayloadAction<string[]>) => {
      state.going.timeFilter = action.payload;
    },
    setGoingDriverTimeFilter: (state, action: PayloadAction<string[]>) => {
      state.going.driverTimeFilter = action.payload;
    },
    setGoingDriverSearch: (state, action: PayloadAction<string>) => {
      state.going.driverSearch = action.payload;
    },
    setGoingPassengerSearch: (state, action: PayloadAction<string>) => {
      state.going.passengerSearch = action.payload;
    },
    // Return route selection actions
    setReturnDriver: (state, action: PayloadAction<string | null>) => {
      state.return.selectedDriver = action.payload;
    },
    setReturnPassengers: (state, action: PayloadAction<string[]>) => {
      state.return.selectedPassengers = action.payload;
    },
    setReturnPickupCityFilter: (state, action: PayloadAction<string>) => {
      state.return.pickupCityFilter = action.payload;
    },
    setReturnDestinationCityFilter: (state, action: PayloadAction<string>) => {
      state.return.destinationCityFilter = action.payload;
    },
    setReturnTimeFilter: (state, action: PayloadAction<string[]>) => {
      state.return.timeFilter = action.payload;
    },
    setReturnDriverTimeFilter: (state, action: PayloadAction<string[]>) => {
      state.return.driverTimeFilter = action.payload;
    },
    setReturnDriverSearch: (state, action: PayloadAction<string>) => {
      state.return.driverSearch = action.payload;
    },
    setReturnPassengerSearch: (state, action: PayloadAction<string>) => {
      state.return.passengerSearch = action.payload;
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
  setGoingDriver,
  setGoingPassengers,
  setGoingPickupCityFilter,
  setGoingDestinationCityFilter,
  setGoingTimeFilter,
  setGoingDriverTimeFilter,
  setGoingDriverSearch,
  setGoingPassengerSearch,
  setReturnDriver,
  setReturnPassengers,
  setReturnPickupCityFilter,
  setReturnDestinationCityFilter,
  setReturnTimeFilter,
  setReturnDriverTimeFilter,
  setReturnDriverSearch,
  setReturnPassengerSearch,
} = filterSlice.actions;
export default filterSlice.reducer;
