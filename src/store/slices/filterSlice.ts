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

interface CombinedRouteFilters {
  selectedDate: string;
  selectedShift: string;
  // Going part
  goingDriver: string | null;
  goingPassengers: string[];
  goingPickupCityFilter: string;
  goingDestinationCityFilter: string;
  goingTimeFilter: string[];
  goingDriverTimeFilter: string[];
  goingDriverSearch: string;
  goingPassengerSearch: string;
  // Return part
  returnDriver: string | null;
  returnPassengers: string[];
  returnPickupCityFilter: string;
  returnDestinationCityFilter: string;
  returnTimeFilter: string[];
  returnDriverTimeFilter: string[];
  returnDriverSearch: string;
  returnPassengerSearch: string;
  // Current step
  currentStep: 'going' | 'return';
}

interface FilterState {
  going: RouteFilters;
  return: RouteFilters;
  combined: CombinedRouteFilters;
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
  combined: {
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
  setReturnDriver,
  setReturnPassengers,
  setReturnPickupCityFilter,
  setReturnDestinationCityFilter,
  setReturnTimeFilter,
  setReturnDriverTimeFilter,
  setReturnDriverSearch,
  setReturnPassengerSearch,
  // Combined route actions
  setCombinedDate,
  setCombinedShift,
  setCombinedStep,
  setCombinedGoingDriver,
  setCombinedGoingPassengers,
  setCombinedGoingPickupCityFilter,
  setCombinedGoingDestinationCityFilter,
  setCombinedGoingTimeFilter,
  setCombinedGoingDriverTimeFilter,
  setCombinedGoingDriverSearch,
  setCombinedGoingPassengerSearch,
  setCombinedReturnDriver,
  setCombinedReturnPassengers,
  setCombinedReturnPickupCityFilter,
  setCombinedReturnDestinationCityFilter,
  setCombinedReturnTimeFilter,
  setCombinedReturnDriverTimeFilter,
  setCombinedReturnDriverSearch,
  setCombinedReturnPassengerSearch,
  resetCombinedFilters,
} = filterSlice.actions;
export default filterSlice.reducer;
