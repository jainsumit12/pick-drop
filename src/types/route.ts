export interface RouteInfo {
  distance: number;
  duration: number;
  route: any;
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
  routeType: 'going' | 'return' | 'pickup';
}
