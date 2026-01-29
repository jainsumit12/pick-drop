export interface RouteInfo {
  distance: number;
  duration: number;
  route: any;
}

export interface RouteParticipant {
  id: string;
  name: string;
  phone: string;
  address: string;
  subPoint: string;
  time?: string;
  coordinates: [number, number];
  destinationCoordinates?: [number, number];
  destination?: string;
  destinationSubPoint?: string;
}

export interface SavedRoute {
  id: string;
  name: string;
  driverId: string;
  passengerIds: string[];
  routeInfo: RouteInfo;
  color: { primary: string; name: string };
  visible: boolean;
  createdAt: string;
  routeType: 'going' | 'return' | 'pickup' | 'combined';
  driverSnapshot?: RouteParticipant;
  passengerSnapshots?: RouteParticipant[];
  date: string;
  shift: string;
  // Combined route specific fields
  returnDriverId?: string;
  returnPassengerIds?: string[];
  returnRouteInfo?: RouteInfo;
  returnDriverSnapshot?: RouteParticipant;
  returnPassengerSnapshots?: RouteParticipant[];
}
