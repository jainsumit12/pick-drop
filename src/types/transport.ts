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
  lat: string;
  long: string;
}

export interface ShiftDriver {
  DRIVER_ID: string;
  SHIFT: string;
  DATE: string;
  TIME: string;
  DRIVER_NAME: string;
  DRIVER_PHONE: string;
  HOME_LOCATION: string;
  DRIVER_SUBPOINT: string;
  HOME_LAT: number | string | null;
  HOME_LOG: number | string | null;
}

export interface PassengerBase {
  SHIFT: string;
  DATE: string;
  TIME: string;
  NAME: string;
  MOBILE: string | number;
  PICKUP_LOCATION: string;
  PICKUP_LAT: number | string | null;
  PICKUP_LOG: number | string | null;
  PICKUP_SUBPOINT: string;
  DROP_LOCATION: string;
  DROP_LAT: number | string | null;
  DROP_LOG: number | string | null;
  DROP_SUBPOINT: string;
}

export interface Passenger extends PassengerBase {
  id: string;
}

export interface ShiftPassenger extends PassengerBase {}
