import axiosInstance from "../axios";

export interface Driver {
  driver_id: number;
  name: string;
  mobile: string;
  going_afternoon: string; // empty string allowed
  going_morning: string; // empty string allowed
  postal_code: string;
  city: string;
  subpoint: string;
  address: string;
  lat: string;   // keeping as string since API sends string
  long: string;  // same here
}

interface Passenger {
  id: string;
  SHIFT: string;
  DATE: string;
  TIME: string;
  NAME: string;
  MOBILE: string | number;
  PICKUP_LOCATION: string;
  PICKUP_LAT: number | null;
  PICKUP_LOG: number | null;
  PICKUP_SUBPOINT: string;
  DROP_LOCATION: string;
  DROP_LAT: number | null;
  DROP_LOG: number | null;
  DROP_SUBPOINT: string;
}

export const driversService = {
  getAllDrivers: async (
    date: string,
    route: string,
    shift?: string
  ): Promise<Driver[]> => {
    const response = await axiosInstance.get<Driver[]>(
      `exportdrivershift/${route}/${shift}/${date}`
    );
    return response.data;
  },
};

export const passengersService = {
  getAllPassengers: async (shift?: string): Promise<Passenger[]> => {
    const response = await axiosInstance.get<Passenger[]>("/passengers", {
      params: { shift },
    });
    return response.data;
  },

  getPassengersByShift: async (shift: string): Promise<Passenger[]> => {
    const response = await axiosInstance.get<Passenger[]>("/passengers", {
      params: { shift },
    });
    return response.data;
  },
};
