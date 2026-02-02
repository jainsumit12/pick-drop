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
  editingRouteId: string | null;
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
    editingRouteId: null,
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
    editingRouteId: null,
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
      state.going.editingRouteId = null;
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
      state.return.editingRouteId = null;
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
      state.going.editingRouteId = null;
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
      state.return.editingRouteId = null;
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
    setGoingEditingRouteId: (state, action: PayloadAction<string | null>) => {
      state.going.editingRouteId = action.payload;
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
    setReturnEditingRouteId: (state, action: PayloadAction<string | null>) => {
      state.return.editingRouteId = action.payload;
    },
    // Combined route actions
    setCombinedDate: (state, action: PayloadAction<string>) => {
      state.combined.selectedDate = action.payload;
    },
    setCombinedShift: (state, action: PayloadAction<string>) => {
      state.combined.selectedShift = action.payload;
    },
    setCombinedStep: (state, action: PayloadAction<'going' | 'return'>) => {
      state.combined.currentStep = action.payload;
    },
    setCombinedGoingDriver: (state, action: PayloadAction<string | null>) => {
      state.combined.goingDriver = action.payload;
    },
    setCombinedGoingPassengers: (state, action: PayloadAction<string[]>) => {
      state.combined.goingPassengers = action.payload;
    },
    setCombinedGoingPickupCityFilter: (state, action: PayloadAction<string>) => {
      state.combined.goingPickupCityFilter = action.payload;
    },
    setCombinedGoingDestinationCityFilter: (state, action: PayloadAction<string>) => {
      state.combined.goingDestinationCityFilter = action.payload;
    },
    setCombinedGoingTimeFilter: (state, action: PayloadAction<string[]>) => {
      state.combined.goingTimeFilter = action.payload;
    },
    setCombinedGoingDriverTimeFilter: (state, action: PayloadAction<string[]>) => {
      state.combined.goingDriverTimeFilter = action.payload;
    },
    setCombinedGoingDriverSearch: (state, action: PayloadAction<string>) => {
      state.combined.goingDriverSearch = action.payload;
    },
    setCombinedGoingPassengerSearch: (state, action: PayloadAction<string>) => {
      state.combined.goingPassengerSearch = action.payload;
    },
    setCombinedReturnDriver: (state, action: PayloadAction<string | null>) => {
      state.combined.returnDriver = action.payload;
    },
    setCombinedReturnPassengers: (state, action: PayloadAction<string[]>) => {
      state.combined.returnPassengers = action.payload;
    },
    setCombinedReturnPickupCityFilter: (state, action: PayloadAction<string>) => {
      state.combined.returnPickupCityFilter = action.payload;
    },
    setCombinedReturnDestinationCityFilter: (state, action: PayloadAction<string>) => {
      state.combined.returnDestinationCityFilter = action.payload;
    },
    setCombinedReturnTimeFilter: (state, action: PayloadAction<string[]>) => {
      state.combined.returnTimeFilter = action.payload;
    },
    setCombinedReturnDriverTimeFilter: (state, action: PayloadAction<string[]>) => {
      state.combined.returnDriverTimeFilter = action.payload;
    },
    setCombinedReturnDriverSearch: (state, action: PayloadAction<string>) => {
      state.combined.returnDriverSearch = action.payload;
    },
    setCombinedReturnPassengerSearch: (state, action: PayloadAction<string>) => {
      state.combined.returnPassengerSearch = action.payload;
    },
    resetCombinedFilters: (state) => {
      state.combined = {
        selectedDate: getInitialDate(),
        selectedShift: 'Morning',
        goingDriver: null,
        goingPassengers: [],
        goingPickupCityFilter: 'All',
        goingDestinationCityFilter: 'All',
        goingTimeFilter: [],
        goingDriverTimeFilter: [],
        goingDriverSearch: '',
        goingPassengerSearch: '',
        returnDriver: null,
        returnPassengers: [],
        returnPickupCityFilter: 'All',
        returnDestinationCityFilter: 'All',
        returnTimeFilter: [],
        returnDriverTimeFilter: [],
        returnDriverSearch: '',
        returnPassengerSearch: '',
        currentStep: 'going',
      };
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
  setGoingEditingRouteId,
  setReturnDriver,
  setReturnPassengers,
  setReturnPickupCityFilter,
  setReturnDestinationCityFilter,
  setReturnTimeFilter,
  setReturnDriverTimeFilter,
  setReturnDriverSearch,
  setReturnPassengerSearch,
  setReturnEditingRouteId,
} = filterSlice.actions;
export default filterSlice.reducer;
