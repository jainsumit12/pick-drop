import axiosInstance from "../axios";
import { Passenger, ShiftDriver, ShiftPassenger } from "../../types/transport";

export const driversService = {
  getDriversByShift: async (
    date: string,
    route: string,
    shift?: string
  ): Promise<ShiftDriver[]> => {
    const response = await axiosInstance.get<
      ShiftDriver[] | { data: ShiftDriver[] }
    >(
      `exportdrivershift/${route}/${shift}/${date}`
    );
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data?.data ?? [];
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

  getPassengersByShiftDateRoute: async (
    date: string,
    route: string,
    shift?: string
  ): Promise<ShiftPassenger[]> => {
    const response = await axiosInstance.get<
      ShiftPassenger[] | { data: ShiftPassenger[] }
    >(`exportbooking/${route}/${shift}/${date}`);
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data?.data ?? [];
  },
};
