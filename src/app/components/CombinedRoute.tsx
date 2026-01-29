import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { Button } from "./ui/button";
import {
  Car,
  Users,
  Clock,
  Save,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Calendar,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { driversService, passengersService } from "../../api/services";
import { RouteParticipant, SavedRoute, RouteInfo } from "../../types/route";
import { ShiftDriver, ShiftPassenger } from "../../types/transport";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setCombinedDate,
  setCombinedShift,
  setCombinedStep,
  setCombinedGoingDriver,
  setCombinedGoingPassengers,
  setCombinedReturnPassengers,
  resetCombinedFilters,
} from "../../store/slices/filterSlice";
import { SHIFT_TYPES, normalizeShift } from "../../constants/shifts";

interface Location {
  id: string;
  name: string;
  coordinates: [number, number];
  type: "driver" | "passenger";
  phone: string;
  address: string;
  subPoint: string;
  shiftTime: string;
  time?: string;
  destinationCoordinates?: [number, number];
  destination?: string;
  destinationSubPoint?: string;
}

interface CombinedRouteProps {
  savedRoutes: SavedRoute[];
  onSaveRoute: (route: SavedRoute) => void;
}

const extractCleanName = (fullName: string): string => {
  const match = fullName.match(/^([^-]+)/);
  return match ? match[1].trim() : fullName;
};

const parseCoordinate = (value: number | string | null): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTime = (time: string): string => {
  const trimmed = time.trim();
  const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})/);
  return timeMatch ? timeMatch[1] : trimmed;
};

const formatDateForApi = (date: string): string => {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}-${month}-${year}`;
};

const toParticipantSnapshot = (location: Location): RouteParticipant => ({
  id: location.id,
  name: location.name,
  phone: location.phone,
  address: location.address,
  subPoint: location.subPoint,
  time: location.time,
  coordinates: location.coordinates,
  destinationCoordinates: location.destinationCoordinates,
  destination: location.destination,
  destinationSubPoint: location.destinationSubPoint,
});

// Convert driver data to Location format (with shift filter)
const convertRidersToLocations = (riders: ShiftDriver[], shift: string): Location[] => {
  return riders.flatMap((rider) => {
    const lat = parseCoordinate(rider.HOME_LAT);
    const log = parseCoordinate(rider.HOME_LOG);
    if (rider.SHIFT !== shift || lat === null || log === null) return [];

    return [{
      id: rider.DRIVER_ID,
      name: extractCleanName(rider.DRIVER_NAME),
      coordinates: [log, lat] as [number, number],
      type: "driver" as const,
      phone: rider.DRIVER_PHONE,
      address: rider.HOME_LOCATION,
      subPoint: rider.DRIVER_SUBPOINT,
      shiftTime: rider.SHIFT,
      time: normalizeTime(rider.TIME || ""),
    }];
  });
};

// Convert passenger data for going route (pickup -> drop)
const convertPassengersToLocations = (passengers: ShiftPassenger[], shift: string): Location[] => {
  return passengers.flatMap((passenger) => {
    const pickupLat = parseCoordinate(passenger.PICKUP_LAT);
    const pickupLog = parseCoordinate(passenger.PICKUP_LOG);
    if (passenger.SHIFT !== shift || pickupLat === null || pickupLog === null) return [];

    const dropLat = parseCoordinate(passenger.DROP_LAT);
    const dropLog = parseCoordinate(passenger.DROP_LOG);

    return [{
      id: passenger.USER_ID,
      name: passenger.NAME,
      coordinates: [pickupLog, pickupLat] as [number, number],
      type: "passenger" as const,
      phone: passenger.MOBILE.toString(),
      address: passenger.PICKUP_LOCATION,
      subPoint: passenger.PICKUP_SUBPOINT,
      shiftTime: passenger.SHIFT,
      time: passenger.TIME,
      destinationCoordinates: dropLat !== null && dropLog !== null ? [dropLog, dropLat] as [number, number] : undefined,
      destination: passenger.DROP_LOCATION,
      destinationSubPoint: passenger.DROP_SUBPOINT,
    }];
  });
};

// Convert passenger data for return route (drop -> pickup, swapped)
const convertReturnPassengersToLocations = (passengers: ShiftPassenger[], shift: string): Location[] => {
  return passengers.flatMap((passenger) => {
    const dropLat = parseCoordinate(passenger.DROP_LAT);
    const dropLog = parseCoordinate(passenger.DROP_LOG);
    if (passenger.SHIFT !== shift || dropLat === null || dropLog === null) return [];

    const pickupLat = parseCoordinate(passenger.PICKUP_LAT);
    const pickupLog = parseCoordinate(passenger.PICKUP_LOG);

    return [{
      id: passenger.USER_ID,
      name: passenger.NAME,
      coordinates: [dropLog, dropLat] as [number, number], // Work location as pickup
      type: "passenger" as const,
      phone: passenger.MOBILE.toString(),
      address: passenger.DROP_LOCATION,
      subPoint: passenger.DROP_SUBPOINT,
      shiftTime: passenger.SHIFT,
      time: passenger.TIME,
      destinationCoordinates: pickupLat !== null && pickupLog !== null ? [pickupLog, pickupLat] as [number, number] : undefined,
      destination: passenger.PICKUP_LOCATION,
      destinationSubPoint: passenger.PICKUP_SUBPOINT,
    }];
  });
};

const getInitialDate = (): string => new Date().toISOString().split("T")[0];

const defaultCombinedState = {
  selectedDate: getInitialDate(),
  selectedShift: "Morning",
  currentStep: "going" as const,
  goingDriver: null as string | null,
  goingPassengers: [] as string[],
  returnPassengers: [] as string[],
};

export function CombinedRoute({ savedRoutes, onSaveRoute }: CombinedRouteProps) {
  const dispatch = useAppDispatch();
  const combinedState = useAppSelector((state) => state.filters.combined);
  const {
    selectedDate,
    selectedShift,
    currentStep,
    goingDriver,
    goingPassengers,
    returnPassengers,
  } = combinedState || defaultCombinedState;

  const normalizedShift = normalizeShift(selectedShift);

  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const goingPassengersRef = useRef<string[]>(goingPassengers);
  const returnPassengersRef = useRef<string[]>(returnPassengers);
  const currentStepRef = useRef<string>(currentStep);

  // State
  const [goingRouteInfo, setGoingRouteInfo] = useState<RouteInfo | null>(null);
  const [returnRouteInfo, setReturnRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeColorIndex] = useState(0);

  // Data states
  const [goingDriversData, setGoingDriversData] = useState<ShiftDriver[]>([]);
  const [goingPassengersData, setGoingPassengersData] = useState<ShiftPassenger[]>([]);
  const [returnPassengersData, setReturnPassengersData] = useState<ShiftPassenger[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Dropdown states
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // Dialog states
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogMessage, setSaveDialogMessage] = useState("");

  const shifts = SHIFT_TYPES;
  const routeColors = [
    { primary: "#8b5cf6", name: "Purple" },
    { primary: "#ec4899", name: "Pink" },
    { primary: "#f59e0b", name: "Orange" },
    { primary: "#10b981", name: "Green" },
    { primary: "#3b82f6", name: "Blue" },
  ];

  // Keep refs in sync
  useEffect(() => { goingPassengersRef.current = goingPassengers; }, [goingPassengers]);
  useEffect(() => { returnPassengersRef.current = returnPassengers; }, [returnPassengers]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);

  // Convert data to locations
  const goingDrivers = convertRidersToLocations(goingDriversData, normalizedShift);
  const goingPassengersList = convertPassengersToLocations(goingPassengersData, normalizedShift);
  const returnPassengersList = convertReturnPassengersToLocations(returnPassengersData, normalizedShift);

  // Current step data
  const currentDrivers = goingDrivers;
  const currentPassengersList = currentStep === "going" ? goingPassengersList : returnPassengersList;
  const currentSelectedDriver = goingDriver;
  const currentSelectedPassengers = currentStep === "going" ? goingPassengers : returnPassengers;

  // Calculate last drop point from going route
  const getLastDropLocation = useCallback((): [number, number] | null => {
    if (!goingDriver || goingPassengers.length === 0) return null;
    const selectedGoingPassengers = goingPassengersList.filter((p) =>
      goingPassengers.map(String).includes(String(p.id))
    );
    const dropCoordinates = selectedGoingPassengers
      .filter((p) => p.destinationCoordinates)
      .map((p) => p.destinationCoordinates!);
    return dropCoordinates.length > 0 ? dropCoordinates[dropCoordinates.length - 1] : null;
  }, [goingDriver, goingPassengers, goingPassengersList]);

  const lastDropLocation = getLastDropLocation();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    mapboxgl.accessToken = 'pk.eyJ1Ijoic2lkaHVkaGlsbG9udGVhbSIsImEiOiJjbTVwMm1mYXYwZ2k4MmtzMWhnbjQ1Z2E0In0.gK3s6yddFXNErt-IbgZ26g';
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-80.5, 43.45],
      zoom: 11,
    });
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Fetch data
  const fetchRouteParticipants = useCallback(async () => {
    setIsLoading(true);
    try {
      const formattedDate = formatDateForApi(selectedDate);
      const shift = normalizedShift.toLowerCase();

      const [goingDriversResult, goingPassengersResult, returnPassengersResult] = await Promise.all([
        driversService.getDriversByShift(formattedDate, "going", shift),
        passengersService.getPassengersByShiftDateRoute(formattedDate, "going", shift),
        passengersService.getPassengersByShiftDateRoute(formattedDate, "return", shift),
      ]);

      setGoingDriversData(Array.isArray(goingDriversResult) ? goingDriversResult : []);
      setGoingPassengersData(Array.isArray(goingPassengersResult) ? goingPassengersResult : []);
      setReturnPassengersData(Array.isArray(returnPassengersResult) ? returnPassengersResult : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, normalizedShift]);

  useEffect(() => {
    fetchRouteParticipants();
  }, [fetchRouteParticipants]);

  // Click handlers using refs
  const handleDriverClick = useCallback((driverId: string, isCurrentlySelected: boolean) => {
    if (currentStepRef.current === "going") {
      dispatch(setCombinedGoingDriver(isCurrentlySelected ? null : driverId));
    }
  }, [dispatch]);

  const handlePassengerClick = useCallback((passengerId: string) => {
    const id = String(passengerId);
    if (currentStepRef.current === "going") {
      const current = goingPassengersRef.current.map(String);
      const updated = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      dispatch(setCombinedGoingPassengers(updated));
    } else {
      const current = returnPassengersRef.current.map(String);
      const updated = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      dispatch(setCombinedReturnPassengers(updated));
    }
  }, [dispatch]);

  // Update markers on map
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add driver markers (only in going step)
    if (currentStep === "going") {
      currentDrivers.forEach((driver) => {
        const isSelected = driver.id === currentSelectedDriver;
        const el = document.createElement("div");
        el.style.cssText = "cursor:pointer;pointer-events:auto;";
        el.innerHTML = `<div style="background:${isSelected ? "#a10505" : "#f20505"};color:white;font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${driver.name.split(" ")[0]} - ${driver.time || ""}</div>`;
        el.onclick = (e) => { e.stopPropagation(); handleDriverClick(driver.id, isSelected); };
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(driver.coordinates).addTo(map.current!);
        markersRef.current.push(marker);
      });
    } else if (lastDropLocation && goingDriver) {
      // Show driver at last drop location in return step
      const driver = goingDrivers.find((d) => d.id === goingDriver);
      if (driver) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="background:#f59e0b;color:white;font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${driver.name.split(" ")[0]} (Start)</div>`;
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(lastDropLocation).addTo(map.current!);
        markersRef.current.push(marker);
      }
    }

    // Add passenger markers
    currentPassengersList.forEach((passenger) => {
      const isSelected = currentSelectedPassengers.map(String).includes(String(passenger.id));
      const color = currentStep === "going" ? (isSelected ? "#22c55e" : "#3b82f6") : (isSelected ? "#f59e0b" : "#8b5cf6");
      const el = document.createElement("div");
      el.style.cssText = "cursor:pointer;pointer-events:auto;display:flex;flex-direction:column;align-items:center;";
      el.innerHTML = `
        <div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
        <div style="background:${color};color:white;font-size:8px;font-weight:600;padding:1px 4px;border-radius:3px;margin-top:2px;white-space:nowrap;">${passenger.time || ""}</div>
      `;
      el.onclick = (e) => { e.stopPropagation(); handlePassengerClick(passenger.id); };
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(passenger.coordinates).addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    if (currentStep === "going") {
      currentDrivers.forEach((d) => bounds.extend(d.coordinates));
    } else if (lastDropLocation) {
      bounds.extend(lastDropLocation);
    }
    currentPassengersList.forEach((p) => bounds.extend(p.coordinates));
    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    }
  }, [currentDrivers, currentPassengersList, currentSelectedDriver, currentSelectedPassengers, currentStep, lastDropLocation, handleDriverClick, handlePassengerClick, goingDriver, goingDrivers]);

  // Route calculation
  const calculateRoute = useCallback(async () => {
    const passengers = currentPassengersList.filter((p) => currentSelectedPassengers.map(String).includes(String(p.id)));
    if (currentStep === "going") {
      const driver = goingDrivers.find((d) => d.id === goingDriver);
      if (!driver || passengers.length === 0 || !map.current) return;
    } else {
      if (!lastDropLocation || passengers.length === 0 || !map.current) return;
    }

    setIsCalculating(true);
    try {
      const getDistance = (c1: [number, number], c2: [number, number]): number => {
        const [lon1, lat1] = c1; const [lon2, lat2] = c2;
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const optimizeRoute = (start: [number, number], locs: [number, number][]): [number, number][] => {
        if (locs.length <= 1) return locs;
        const result: [number, number][] = [];
        const remaining = [...locs];
        let current = start;
        while (remaining.length > 0) {
          let nearestIdx = 0;
          let nearestDist = getDistance(current, remaining[0]);
          for (let i = 1; i < remaining.length; i++) {
            const d = getDistance(current, remaining[i]);
            if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
          }
          result.push(remaining[nearestIdx]);
          current = remaining[nearestIdx];
          remaining.splice(nearestIdx, 1);
        }
        return result;
      };

      let waypoints: [number, number][];
      if (currentStep === "going") {
        const driver = goingDrivers.find((d) => d.id === goingDriver)!;
        const pickups = passengers.map((p) => p.coordinates);
        const dropoffs = passengers.filter((p) => p.destinationCoordinates).map((p) => p.destinationCoordinates!);
        const optPickups = optimizeRoute(driver.coordinates, pickups);
        const lastPickup = optPickups.length > 0 ? optPickups[optPickups.length - 1] : driver.coordinates;
        const optDropoffs = optimizeRoute(lastPickup, dropoffs);
        waypoints = [driver.coordinates, ...optPickups, ...optDropoffs];
      } else {
        const pickups = passengers.map((p) => p.coordinates);
        const dropoffs = passengers.filter((p) => p.destinationCoordinates).map((p) => p.destinationCoordinates!);
        const optPickups = optimizeRoute(lastDropLocation!, pickups);
        const lastPickup = optPickups.length > 0 ? optPickups[optPickups.length - 1] : lastDropLocation!;
        const optDropoffs = optimizeRoute(lastPickup, dropoffs);
        waypoints = [lastDropLocation!, ...optPickups, ...optDropoffs];
      }

      const coordStr = waypoints.map((c) => c.join(",")).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const info = { distance: route.distance / 1000, duration: route.duration / 60, route: route.geometry };
        if (currentStep === "going") setGoingRouteInfo(info); else setReturnRouteInfo(info);

        const sourceId = currentStep === "going" ? "going-route" : "return-route";
        const layerId = sourceId + "-layer";
        if (map.current!.getSource(sourceId)) {
          (map.current!.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(route.geometry);
        } else {
          map.current!.addSource(sourceId, { type: "geojson", data: route.geometry });
          map.current!.addLayer({ id: layerId, type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": routeColors[routeColorIndex].primary, "line-width": 5, "line-opacity": 0.8 } });
        }
        const bounds = new mapboxgl.LngLatBounds();
        waypoints.forEach((c) => bounds.extend(c));
        map.current!.fitBounds(bounds, { padding: 80 });
      }
    } catch (err) {
      console.error("Route calculation error:", err);
    } finally {
      setIsCalculating(false);
    }
  }, [currentStep, currentPassengersList, currentSelectedPassengers, goingDriver, goingDrivers, lastDropLocation, routeColorIndex, routeColors]);

  // Trigger route calculation
  useEffect(() => {
    if (!map.current) return;
    const hasDriver = currentSelectedDriver !== null;
    const hasPassengers = currentSelectedPassengers.length > 0;
    if (hasDriver && hasPassengers) {
      calculateRoute();
    } else {
      const sourceId = currentStep === "going" ? "going-route" : "return-route";
      const layerId = sourceId + "-layer";
      if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      if (currentStep === "going") setGoingRouteInfo(null); else setReturnRouteInfo(null);
    }
  }, [currentSelectedDriver, currentSelectedPassengers, currentStep, calculateRoute]);

  // Sidebar handlers
  const setSelectedDriver = (id: string | null) => {
    if (currentStep === "going") dispatch(setCombinedGoingDriver(id));
  };

  const togglePassenger = (id: string) => {
    const idStr = String(id);
    if (currentStep === "going") {
      const current = goingPassengers.map(String);
      dispatch(setCombinedGoingPassengers(current.includes(idStr) ? current.filter((x) => x !== idStr) : [...current, idStr]));
    } else {
      const current = returnPassengers.map(String);
      dispatch(setCombinedReturnPassengers(current.includes(idStr) ? current.filter((x) => x !== idStr) : [...current, idStr]));
    }
  };

  const goToNextStep = () => currentStep === "going" && dispatch(setCombinedStep("return"));
  const goToPrevStep = () => currentStep === "return" && dispatch(setCombinedStep("going"));

  const clearSelections = () => {
    dispatch(resetCombinedFilters());
    setGoingRouteInfo(null);
    setReturnRouteInfo(null);
  };

  const saveRoute = () => {
    if (!goingDriver || goingPassengers.length === 0) { alert("Please complete going route first"); return; }
    if (returnPassengers.length === 0) { alert("Please select return passengers"); return; }

    const driverData = goingDrivers.find((d) => d.id === goingDriver);
    const goingPData = goingPassengersList.filter((p) => goingPassengers.map(String).includes(String(p.id)));
    const returnPData = returnPassengersList.filter((p) => returnPassengers.map(String).includes(String(p.id)));

    const newRoute: SavedRoute = {
      id: `combined-${Date.now()}`,
      name: `Combined Route ${savedRoutes.filter((r) => r.routeType === "combined").length + 1}`,
      driverId: goingDriver,
      passengerIds: goingPassengers.map(String),
      routeInfo: goingRouteInfo || { distance: 0, duration: 0, route: null },
      color: routeColors[routeColorIndex],
      visible: true,
      createdAt: new Date().toISOString(),
      routeType: "combined",
      driverSnapshot: driverData ? toParticipantSnapshot(driverData) : undefined,
      passengerSnapshots: goingPData.map(toParticipantSnapshot),
      date: selectedDate,
      shift: selectedShift,
      returnDriverId: goingDriver,
      returnPassengerIds: returnPassengers.map(String),
      returnRouteInfo: returnRouteInfo || undefined,
      returnDriverSnapshot: driverData ? toParticipantSnapshot(driverData) : undefined,
      returnPassengerSnapshots: returnPData.map(toParticipantSnapshot),
    };

    onSaveRoute(newRoute);
    clearSelections();
    setSaveDialogMessage("Combined route saved!");
    setShowSaveDialog(true);
  };

  const getDateOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = -7; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      options.push({
        value: date.toISOString().split("T")[0],
        label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    return options;
  };

  const dateOptions = getDateOptions();

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => dispatch(setCombinedStep("going"))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === "going" ? "bg-green-100 text-green-700 border-2 border-green-500" : goingDriver && goingPassengers.length > 0 ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
            }`}
          >
            {goingDriver && goingPassengers.length > 0 && currentStep !== "going" ? <Check className="w-5 h-5" /> : <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">1</span>}
            <span className="font-medium">Going Route</span>
            {goingPassengers.length > 0 && <span className="text-xs bg-green-200 px-2 py-0.5 rounded-full">{goingPassengers.length}</span>}
          </button>

          <ArrowRight className="w-5 h-5 text-gray-400" />

          <button
            type="button"
            onClick={() => goingDriver && goingPassengers.length > 0 && dispatch(setCombinedStep("return"))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === "return" ? "bg-orange-100 text-orange-700 border-2 border-orange-500" : goingDriver && returnPassengers.length > 0 ? "bg-orange-50 text-orange-600" : "bg-gray-100 text-gray-500"
            }`}
          >
            {goingDriver && returnPassengers.length > 0 && currentStep !== "return" ? <Check className="w-5 h-5" /> : <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">2</span>}
            <span className="font-medium">Return Route</span>
            {returnPassengers.length > 0 && <span className="text-xs bg-orange-200 px-2 py-0.5 rounded-full">{returnPassengers.length}</span>}
          </button>
        </div>
      </div>

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-white border-b">
        {/* Date selector */}
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => { setShowDateDropdown(!showDateDropdown); setShowShiftDropdown(false); }} className="h-9">
            <Calendar className="w-4 h-4 mr-1" />
            {new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
          {showDateDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-[100] max-h-60 overflow-y-auto min-w-[150px]">
              {dateOptions.map((opt) => (
                <button key={opt.value} type="button" onClick={() => { dispatch(setCombinedDate(opt.value)); setShowDateDropdown(false); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${selectedDate === opt.value ? "bg-blue-50 text-blue-600" : ""}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Shift selector */}
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => { setShowShiftDropdown(!showShiftDropdown); setShowDateDropdown(false); }} className="h-9">
            <Clock className="w-4 h-4 mr-1" />
            {selectedShift}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
          {showShiftDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-[100]">
              {shifts.map((s) => (
                <button key={s} type="button" onClick={() => { dispatch(setCombinedShift(s)); setShowShiftDropdown(false); }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${selectedShift === s ? "bg-blue-50 text-blue-600" : ""}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step label */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${currentStep === "going" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
          {currentStep === "going" ? "Going Route" : "Return Route"}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={fetchRouteParticipants} disabled={isLoading} className="h-9">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1">Fetch</span>
          </Button>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button type="button" onClick={() => map.current?.zoomIn()} className="px-3 py-2 bg-white hover:bg-gray-100 border-r"><ZoomIn className="w-4 h-4" /></button>
            <button type="button" onClick={() => map.current?.zoomOut()} className="px-3 py-2 bg-white hover:bg-gray-100"><ZoomOut className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r flex flex-col overflow-hidden">
          {/* Driver selection */}
          <div className="p-3 border-b">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Car className="w-4 h-4" />
              {currentStep === "going" ? `Select Driver (${currentDrivers.length})` : "Driver (same as going)"}
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {currentStep === "return" && currentSelectedDriver ? (
                (() => {
                  const driver = currentDrivers.find((d) => d.id === currentSelectedDriver);
                  return driver ? (
                    <div className="flex items-center gap-2 p-2 rounded bg-orange-50 border border-orange-200">
                      <Check className="w-4 h-4 text-orange-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{driver.name}</p>
                        <p className="text-xs text-gray-500 truncate">{driver.subPoint}</p>
                      </div>
                    </div>
                  ) : null;
                })()
              ) : (
                currentDrivers.map((driver) => (
                  <label key={driver.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${currentSelectedDriver === driver.id ? "bg-blue-50 border border-blue-200" : ""}`}>
                    <input type="radio" name="driver" checked={currentSelectedDriver === driver.id} onChange={() => setSelectedDriver(driver.id)} className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{driver.name}</p>
                      <p className="text-xs text-gray-500 truncate">{driver.subPoint}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Passenger selection */}
          <div className="flex-1 p-3 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Select Passengers ({currentSelectedPassengers.length}/{currentPassengersList.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1">
              {currentPassengersList.map((passenger) => {
                const isSelected = currentSelectedPassengers.map(String).includes(String(passenger.id));
                return (
                  <label key={passenger.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${isSelected ? "bg-green-50 border border-green-200" : ""}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => togglePassenger(passenger.id)} className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{passenger.name}</p>
                      <p className="text-xs text-gray-500 truncate">{passenger.subPoint} • {passenger.time}</p>
                    </div>
                  </label>
                );
              })}
              {currentPassengersList.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No passengers available</p>
              )}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="p-3 border-t bg-gray-50 flex gap-2">
            {currentStep === "return" && (
              <Button variant="outline" onClick={goToPrevStep} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            {currentStep === "going" && (
              <Button onClick={goToNextStep} disabled={!goingDriver || goingPassengers.length === 0} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                Next: Return <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {currentStep === "return" && (
              <Button onClick={saveRoute} disabled={returnPassengers.length === 0} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                <Save className="w-4 h-4 mr-1" /> Save Route
              </Button>
            )}
          </div>
        </div>

        {/* Map */}
        <div ref={mapContainer} className="flex-1" />
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-2">Route Saved</h3>
            <p className="text-gray-600 mb-4">{saveDialogMessage}</p>
            <Button onClick={() => setShowSaveDialog(false)} className="w-full">OK</Button>
          </div>
        </div>
      )}
    </div>
  );
}
