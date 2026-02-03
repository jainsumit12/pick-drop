import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Car,
  Users,
  Clock,
  Save,
  X,
  ChevronDown,
  Search,
  MapPin,
  Phone,
  Navigation,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Home,
  Building2,
  Calendar,
  RefreshCw,
  Download,
  Loader2,
  Trash,
  UserPlus,
  List,
  Edit3,
} from "lucide-react";
import { driversService, passengersService } from "../../api/services";
import { RouteParticipant, SavedRoute, RouteInfo } from "../../types/route";
import { ShiftDriver, ShiftPassenger } from "../../types/transport";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setReturnDate,
  setReturnShift,
  setReturnDriver,
  setReturnPassengers,
  setReturnPickupCityFilter,
  setReturnDestinationCityFilter,
  setReturnTimeFilter,
  setReturnDriverTimeFilter,
  setReturnDriverSearch,
  setReturnPassengerSearch,
  setReturnEditingRouteId,
} from "../../store/slices/filterSlice";
import { saveRouteData, clearRouteData } from "../../store/slices/dataSlice";
import { deleteRoute } from "../../store/slices/routesSlice";
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
  color?: string;
}

interface ReturnRouteProps {
  onSaveRoute: (route: SavedRoute) => void;
}

// Helper function to extract clean name from rider name field
const extractCleanName = (fullName: string): string => {
  const match = fullName.match(/^([^-]+)/);
  return match ? match[1].trim() : fullName;
};

// Helper function to extract ID from rider name or generate from name + location
const extractId = (fullName: string, location?: string): string => {
  const match = fullName.match(/- (\d+)/);
  if (match) return match[1];
  // Generate consistent ID from name and location
  const nameStr = fullName.replace(/\s+/g, "-").toLowerCase();
  const locStr = location
    ? location.slice(0, 20).replace(/\s+/g, "-").toLowerCase()
    : "";
  return `${nameStr}-${locStr}`.slice(0, 50);
};

const parseCoordinate = (value: number | string | null): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTime = (time: string): string => {
  const trimmed = (time || "").trim();
  if (trimmed.length === 0) return "";

  // If format isn't numeric time (e.g., "ALL"), return as-is
  if (!/^\d{1,2}(:\d{1,2})?$/.test(trimmed)) {
    return trimmed;
  }

  const [h, m = ""] = trimmed.split(":");
  const hourNum = Number(h);
  const hour = Number.isNaN(hourNum) ? h : String(hourNum); // strip leading zero safely
  const minute = (m || "").padEnd(2, "0").slice(0, 2);
  return `${hour}:${minute}`;
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

const snapshotToLocation = (
  participant: RouteParticipant,
  type: "driver" | "passenger"
): Location => ({
  id: participant.id,
  name: participant.name,
  coordinates: participant.coordinates,
  type,
  phone: participant.phone,
  address: participant.address,
  subPoint: participant.subPoint,
  shiftTime: participant.time || "",
  time: participant.time,
  destinationCoordinates: participant.destinationCoordinates,
  destination: participant.destination,
  destinationSubPoint: participant.destinationSubPoint,
});

// Generate unique color for each passenger using HSL
const generateUniqueColor = (index: number, total: number): string => {
  const hue = (index * 360) / total;
  const saturation = 75;
  const lightness = 50;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Convert rider data to Location format
const convertRidersToLocations = (
  riders: ShiftDriver[],
  shift: string
): Location[] => {
  return riders.flatMap((rider) => {
    const lat = parseCoordinate(rider.HOME_LAT);
    const log = parseCoordinate(rider.HOME_LOG);
    if (rider.SHIFT !== shift || lat === null || log === null) return [];

    return [
      {
        id: rider.DRIVER_ID,
        name: extractCleanName(rider.DRIVER_NAME),
        coordinates: [log, lat],
        type: "driver" as const,
        phone: rider.DRIVER_PHONE,
        address: rider.HOME_LOCATION,
        subPoint: rider.DRIVER_SUBPOINT,
        shiftTime: rider.SHIFT,
        time: normalizeTime(rider.TIME || ""),
      },
    ];
  });
};

// Convert passenger data to Location format for RETURN route
// For Return Route: PICKUP_LOCATION = Factory (current), DROP_LOCATION = Home (destination)
const convertPassengersToLocations = (
  passengers: ShiftPassenger[],
  shift: string
): Location[] => {
  const filteredPassengers = passengers.flatMap((passenger) => {
    const pickupLat = parseCoordinate(passenger.PICKUP_LAT);
    const pickupLog = parseCoordinate(passenger.PICKUP_LOG);
    const dropLat = parseCoordinate(passenger.DROP_LAT);
    const dropLog = parseCoordinate(passenger.DROP_LOG);

    if (
      passenger.SHIFT !== shift ||
      pickupLat === null ||
      pickupLog === null ||
      dropLat === null ||
      dropLog === null
    ) {
      return [];
    }

    return [
      {
        ...passenger,
        PICKUP_LAT: pickupLat,
        PICKUP_LOG: pickupLog,
        DROP_LAT: dropLat,
        DROP_LOG: dropLog,
      },
    ];
  });

  return filteredPassengers.map((passenger, index) => ({
    id: passenger.USER_ID,
    name: passenger.NAME,
    coordinates: [
      passenger.PICKUP_LOG as number,
      passenger.PICKUP_LAT as number,
    ], // Currently at factory
    type: "passenger" as const,
    phone: passenger.MOBILE.toString(),
    address: passenger.PICKUP_LOCATION,
    subPoint: passenger.PICKUP_SUBPOINT,
    shiftTime: passenger.SHIFT,
    time: passenger.TIME,
    destinationCoordinates: [
      passenger.DROP_LOG as number,
      passenger.DROP_LAT as number,
    ], // Going home
    destination: passenger.DROP_LOCATION,
    destinationSubPoint: passenger.DROP_SUBPOINT,
    color: generateUniqueColor(index, filteredPassengers.length),
  }));
};

export function ReturnRoute({ onSaveRoute }: ReturnRouteProps) {
  const dispatch = useAppDispatch();
  const {
    selectedDate,
    selectedShift,
    selectedDriver,
    selectedPassengers,
    pickupCityFilter,
    destinationCityFilter,
    timeFilter,
    driverTimeFilter,
    driverSearch,
    passengerSearch,
    editingRouteId,
  } = useAppSelector((state) => state.filters.return);
  const storedRoutes = useAppSelector((state) => state.routes.savedRoutes);

  const setSelectedDriver = (driver: string | null) => {
    dispatch(setReturnDriver(driver));
  };

  const setSelectedPassengers = (passengers: string[]) => {
    dispatch(setReturnPassengers(passengers));
  };

  const setPickupCityFilter = (value: string) => {
    dispatch(setReturnPickupCityFilter(value));
  };

  const setDestinationCityFilter = (value: string) => {
    dispatch(setReturnDestinationCityFilter(value));
  };

  const setTimeFilter = (values: string[]) => {
    dispatch(setReturnTimeFilter(values));
  };

  const setDriverTimeFilter = (values: string[]) => {
    dispatch(setReturnDriverTimeFilter(values));
  };

  const setDriverSearch = (value: string) => {
    dispatch(setReturnDriverSearch(value));
  };

  const setPassengerSearch = (value: string) => {
    dispatch(setReturnPassengerSearch(value));
  };

  const returnRoutes = storedRoutes.filter(
    (route) => route.routeType === "return"
  );

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const selectedPassengersRef = useRef<string[]>(selectedPassengers);
  // Keep ref updated with latest selectedPassengers
  selectedPassengersRef.current = selectedPassengers;
  const queuedLayerIdsRef = useRef<Set<string>>(new Set());
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeColorIndex, setRouteColorIndex] = useState(() => returnRoutes.length % 10);
  const [driversData, setDriversData] = useState<ShiftDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [passengersData, setPassengersData] = useState<ShiftPassenger[]>([]);
  const [passengersLoading, setPassengersLoading] = useState(false);
  const [passengersError, setPassengersError] = useState<string | null>(null);
  const [pendingRoutes, setPendingRoutes] = useState<SavedRoute[]>([]);
  const [editingQueuedRoute, setEditingQueuedRoute] = useState<{
    id: string;
    name: string;
    color: { primary: string; name: string };
  } | null>(null);

  // Dropdown states
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [showPassengerDropdown, setShowPassengerDropdown] = useState(false);
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showOccupiedDropdown, setShowOccupiedDropdown] = useState(false);
  const [showDummyPassengerModal, setShowDummyPassengerModal] = useState(false);

  // Filter states
  const [checkedDrivers, setCheckedDrivers] = useState<string[]>([]); // Drivers visible on map

  const toggleDriverVisibility = (driverId: string) => {
    setCheckedDrivers((prev) =>
      prev.includes(driverId)
        ? prev.filter((id) => id !== driverId)
        : [...prev, driverId]
    );
  };

  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showDriverTimeDropdown, setShowDriverTimeDropdown] = useState(false);

  // Bottom panel state
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogMessage, setSaveDialogMessage] = useState("");

  const createEmptyRow = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    homeLat: "",
    homeLog: "",
  });
  const [dummyPassengerRows, setDummyPassengerRows] = useState([
    createEmptyRow(),
  ]);
  const [returnDummyPassengerCount, setReturnDummyPassengerCount] = useState(0);

  const shifts = SHIFT_TYPES;

  const routeColors = [
    { primary: "#3b82f6", name: "Blue" },
    { primary: "#8b5cf6", name: "Purple" },
    { primary: "#ec4899", name: "Pink" },
    { primary: "#f59e0b", name: "Orange" },
    { primary: "#10b981", name: "Green" },
    { primary: "#ef4444", name: "Red" },
    { primary: "#06b6d4", name: "Cyan" },
    { primary: "#f97316", name: "Dark Orange" },
    { primary: "#14b8a6", name: "Teal" },
    { primary: "#a855f7", name: "Violet" },
  ];

  const routeType: "return" = "return";
  const routeTypeLabel = routeType.charAt(0).toUpperCase() + routeType.slice(1);
  const normalizedShift = normalizeShift(selectedShift);
  const savedRouteData = useAppSelector(
    (state) => state.data.byDate[selectedDate]?.return?.[normalizedShift]
  );

  const formatLastFetched = (timestamp?: string | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString([], {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
      month: "short",
      day: "numeric",
    });
  };
  const lastFetchedLabel = formatLastFetched(savedRouteData?.lastFetched);

  // Load data from Redux if available, otherwise start with empty arrays
  useEffect(() => {
    const hasReduxData =
      (savedRouteData?.drivers.length ?? 0) > 0 ||
      (savedRouteData?.passengers.length ?? 0) > 0;

    if (hasReduxData && savedRouteData) {
      setDriversData(savedRouteData.drivers);
      setPassengersData(savedRouteData.passengers);
    } else {
      setDriversData([]);
      setPassengersData([]);
    }

    setDriversError(null);
    setPassengersError(null);
    setCheckedDrivers([]);
  }, [normalizedShift, selectedDate, savedRouteData]);

  // Get drivers for selected shift
  const drivers = convertRidersToLocations(driversData, selectedShift);

  // Get passengers for selected shift
  const passengers = convertPassengersToLocations(
    passengersData,
    selectedShift
  );

  // Filter out drivers and passengers that are already used in saved RETURN routes only
  const usedDriverIds = new Set(
    storedRoutes
      .filter((route) => route.routeType === "return" && route.id !== editingRouteId)
      .map((route) => String(route.driverId))
  );
  const usedPassengerIds = new Set(
    storedRoutes
      .filter((route) => route.routeType === "return" && route.id !== editingRouteId)
      .flatMap((route) => route.passengerIds.map((id) => String(id)))
  );

  const queuedDriverIds = new Set(pendingRoutes.map((route) => String(route.driverId)));
  const queuedPassengerIds = new Set(
    pendingRoutes.flatMap((route) => route.passengerIds.map((id) => String(id)))
  );

  queuedDriverIds.forEach((id) => {
    if (id) usedDriverIds.add(id);
  });
  queuedPassengerIds.forEach((id) => {
    if (id) usedPassengerIds.add(id);
  });

  const queuedDriverColorMap = new Map<string, string>();
  const queuedPassengerColorMap = new Map<string, string>();
  pendingRoutes.forEach((route) => {
    if (route.driverId) {
      queuedDriverColorMap.set(String(route.driverId), route.color.primary);
    }
    route.passengerIds.forEach((passengerId) => {
      queuedPassengerColorMap.set(String(passengerId), route.color.primary);
    });
  });

  const queuedDriverLocations = pendingRoutes
    .map((route) => route.driverSnapshot)
    .filter((driver): driver is RouteParticipant => Boolean(driver))
    .map((driver) => snapshotToLocation(driver, "driver"));

  const queuedPassengerLocations = pendingRoutes
    .flatMap((route) => route.passengerSnapshots ?? [])
    .map((passenger) => snapshotToLocation(passenger, "passenger"));

  const occupiedDrivers = drivers.filter(
    (driver) =>
      usedDriverIds.has(String(driver.id)) && driver.id !== selectedDriver
  );
  const availableDrivers = drivers.filter(
    (driver) =>
      !usedDriverIds.has(String(driver.id)) || driver.id === selectedDriver
  );
  const selectedPassengerSet = new Set(selectedPassengers.map((s) => String(s)));
  const availablePassengers = passengers.filter(
    (passenger) =>
      !usedPassengerIds.has(String(passenger.id)) ||
      selectedPassengerSet.has(String(passenger.id))
  );

  const displayDriverCount = availableDrivers.length;
  const displayPassengerCount = availablePassengers.length;
  const totalDriverCount = drivers.length;
  const occupiedDriverCount = usedDriverIds.size;

  // Extract unique filter options from passenger data (for Return: factory locations are "pickup", home locations are "destination")
  const rawPassengerData = passengersData.filter(
    (p) => p.SHIFT === selectedShift
  );
  const pickupCities = [
    "All",
    ...Array.from(new Set(rawPassengerData.map((p) => p.PICKUP_SUBPOINT))),
  ]; // Factory locations
  const destinationCities = [
    "All",
    ...Array.from(new Set(rawPassengerData.map((p) => p.DROP_SUBPOINT))),
  ]; // Home locations
  const times = [
    "All",
    ...Array.from(new Set(rawPassengerData.map((p) => p.TIME))).sort(),
  ];

  // Extract unique driver times
  const rawDriverData = driversData.filter((r) => r.SHIFT === selectedShift);
  const driverTimes = Array.from(
    new Set(
      rawDriverData.map((r) => normalizeTime(r.TIME || "")).filter(Boolean)
    )
  ).sort();

  // Filter drivers and passengers based on search
  const filteredDrivers = availableDrivers.filter((d) => {
    const driverId = String(d.id)?.toLowerCase();
    const matchesSearch =
      d.name?.toLowerCase().includes(driverSearch?.toLowerCase()) ||
      driverId.includes(driverSearch?.toLowerCase()) ||
      d.subPoint?.toLowerCase().includes(driverSearch?.toLowerCase());

    // Find original driver data to check time
    const originalDriver = rawDriverData.find(
      (rd) =>
        extractCleanName(rd.DRIVER_NAME)?.toLowerCase() ===
          d.name?.toLowerCase() &&
        (rd.DRIVER_SUBPOINT || rd.HOME_LOCATION || "")?.toLowerCase() ===
          d.subPoint?.toLowerCase()
    );
    const originalTime = normalizeTime(originalDriver?.TIME || "");

    // If no time filter selected, show all drivers
    if (driverTimeFilter?.length === 0) {
      return matchesSearch;
    }

    // If time filter selected, require matching time (normalized)
    const normalizedFilter = driverTimeFilter?.map((t) => normalizeTime(t));
    const matchesTime =
      originalTime !== "" && normalizedFilter?.includes(originalTime);

    return matchesSearch && matchesTime;
  });

  // Apply all filters to passengers
  const filteredPassengers = availablePassengers.filter((p) => {
    const passengerId = String(p.id)?.toLowerCase();
    const matchesSearch =
      p.name?.toLowerCase().includes(passengerSearch?.toLowerCase()) ||
      passengerId.includes(passengerSearch?.toLowerCase()) ||
      p.subPoint?.toLowerCase().includes(passengerSearch?.toLowerCase()) ||
      (p.destinationSubPoint &&
        p.destinationSubPoint
          ?.toLowerCase()
          ?.includes(passengerSearch?.toLowerCase())) ||
      p.address?.toLowerCase().includes(passengerSearch?.toLowerCase()) ||
      (p.destination &&
        p.destination?.toLowerCase().includes(passengerSearch?.toLowerCase()));

    const matchesPickupCity =
      pickupCityFilter === "All" || p.subPoint === pickupCityFilter; // Factory location (PICKUP in raw data)
    const matchesDestinationCity =
      destinationCityFilter === "All" ||
      p.destinationSubPoint === destinationCityFilter; // Home location (DROP in raw data)

    // Find original passenger data to check time
    const originalPassenger = rawPassengerData.find(
      (pd) =>
        extractCleanName(pd.NAME) === p.name &&
        pd.PICKUP_SUBPOINT === p.subPoint
    );

    const matchesTime =
      timeFilter.length === 0 ||
      timeFilter.includes(originalPassenger?.TIME || "");

    return (
      matchesSearch &&
      matchesPickupCity &&
      matchesDestinationCity &&
      matchesTime
    );
  });

    const queuedDestinationPassengers = queuedPassengerLocations.filter(
      (passenger) =>
        passenger.destinationCoordinates &&
        !filteredPassengers.some(
          (fp) =>
            String(fp.id) === String(passenger.id) &&
            fp.destinationCoordinates
        )
    );

  // Get selected driver and passengers
  const currentDriver = availableDrivers.find((d) => d.id === selectedDriver);
  const currentPassengers = availablePassengers.filter((p) =>
    selectedPassengers.map((s) => String(s)).includes(String(p.id))
  );

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-80.4925, 43.4516],
        zoom: 10,
      });

      // Remove the default navigation control - we'll add custom controls in the menu bar
    } catch (error) {
      console.error("Error initializing map:", error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-container")) {
        setShowDriverDropdown(false);
        setShowPassengerDropdown(false);
        setShowShiftDropdown(false);
        setShowDateDropdown(false);
        setShowOccupiedDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Document-level handler for passenger selection buttons in popups
  useEffect(() => {
    const handlePassengerButtonClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Handle individual passenger toggle button
      const toggleBtn = target.closest(
        ".passenger-toggle[data-passenger-id]"
      ) as HTMLElement;
      if (toggleBtn) {
        if (toggleBtn.getAttribute("data-queued") === "true") {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
        const passengerId = toggleBtn.getAttribute("data-passenger-id");
        if (passengerId) {
          const current = selectedPassengersRef.current.map((id) => String(id));
          const newPassengers = current.includes(passengerId)
            ? current.filter((id) => id !== passengerId)
            : [...current, passengerId];
          dispatch(setReturnPassengers(newPassengers));
        }
        return;
      }

      // Handle "Select all" button (work location)
      const selectAllBtn = target.closest(
        ".select-all-passengers[data-passenger-ids]"
      ) as HTMLElement;
      if (selectAllBtn) {
        event.stopPropagation();
        event.preventDefault();
        const passengerIdsStr = selectAllBtn.getAttribute("data-passenger-ids");
        if (!passengerIdsStr) return;
        const passengerIds = passengerIdsStr.split(",");
        const filteredIds = passengerIds.filter(
          (id) => !queuedPassengerIds.has(id)
        );
        if (filteredIds.length === 0) return;
        const current = selectedPassengersRef.current.map((id) => String(id));
        const allSelected = filteredIds.every((id) => current.includes(id));

        if (allSelected) {
          const newPassengers = current.filter(
            (id) => !filteredIds.includes(id)
          );
          dispatch(setReturnPassengers(newPassengers));
        } else {
          const newPassengers = [...new Set([...current, ...filteredIds])];
          dispatch(setReturnPassengers(newPassengers));
        }
        return;
      }

      // Handle "Select all" button (home location)
      const selectAllHomeBtn = target.closest(
        ".select-all-home-passengers[data-passenger-ids]"
      ) as HTMLElement;
      if (selectAllHomeBtn) {
        event.stopPropagation();
        event.preventDefault();
        const passengerIdsStr =
          selectAllHomeBtn.getAttribute("data-passenger-ids");
        if (!passengerIdsStr) return;
        const passengerIds = passengerIdsStr.split(",");
        const filteredIds = passengerIds.filter(
          (id) => !queuedPassengerIds.has(id)
        );
        if (filteredIds.length === 0) return;
        const current = selectedPassengersRef.current.map((id) => String(id));
        const allSelected = filteredIds.every((id) => current.includes(id));

        if (allSelected) {
          const newPassengers = current.filter(
            (id) => !filteredIds.includes(id)
          );
          dispatch(setReturnPassengers(newPassengers));
        } else {
          const newPassengers = [...new Set([...current, ...filteredIds])];
          dispatch(setReturnPassengers(newPassengers));
        }
        return;
      }
    };

    document.addEventListener("click", handlePassengerButtonClick);
    return () =>
      document.removeEventListener("click", handlePassengerButtonClick);
  }, [dispatch, pendingRoutes]);

  useEffect(() => {
    if (!map.current) return;

    if (!map.current.isStyleLoaded()) {
      map.current.once("load", () => {
        updateMarkersAndRoute();
      });
      return;
    }

    updateMarkersAndRoute();
  }, [
    selectedDriver,
    selectedPassengers,
    selectedShift,
    driversData,
    passengersData,
    pickupCityFilter,
    destinationCityFilter,
    timeFilter,
    driverTimeFilter,
    passengerSearch,
    driverSearch,
    checkedDrivers,
    pendingRoutes,
  ]);

  const updateMarkersAndRoute = () => {
    if (!map.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add driver markers based on filter and checkbox selection
    const baseDrivers =
      checkedDrivers.length > 0
        ? drivers.filter((d) => checkedDrivers.includes(d.id))
        : filteredDrivers;
    const driverIdSet = new Set(baseDrivers.map((driver) => String(driver.id)));
    const driversToShow = [
      ...baseDrivers,
      ...queuedDriverLocations.filter(
        (driver) => !driverIdSet.has(String(driver.id))
      ),
    ];

    const driverGroups = new Map<string, Location[]>();
    driversToShow.forEach((driver) => {
      const coordKey = `${driver.coordinates[0]},${driver.coordinates[1]}`;
      if (!driverGroups.has(coordKey)) {
        driverGroups.set(coordKey, []);
      }
      driverGroups.get(coordKey)!.push(driver);
    });

    driverGroups.forEach((driversAtLocation, coordKey) => {
      const [lng, lat] = coordKey.split(",").map(Number);
      const coordinates: [number, number] = [lng, lat];
      const driverCount = driversAtLocation.length;

      if (driverCount === 1) {
        const driver = driversAtLocation[0];
        const isSelected = driver.id === selectedDriver;
        const displayName = driver.name.split(" ")[0];
        const el = document.createElement("div");
        el.style.boxShadow = isSelected
          ? "0 6px 14px rgba(37,99,235,0.35)"
          : "0 2px 4px rgba(0,0,0,0.2)";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.cursor = "pointer";
        el.style.transition = "all 0.2s";
        el.style.transform = isSelected ? "scale(1.08)" : "scale(1)";

        el.style.borderRadius = "6px";
        el.style.backgroundColor = isSelected ? "rgba(37,99,235,0.08)" : "";
        const queuedDriverColor = queuedDriverColorMap.get(String(driver.id));
        const driverMarkerColor = queuedDriverColor || (isSelected ? "#a10505" : "#f20505");
        el.innerHTML = `
          <div style="
            background-color: ${driverMarkerColor};
            color: white;
            font-size: 9px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            margin-top: 2px;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            max-width:"${isSelected ? "70px" : "60px"}";
            overflow: hidden;
            text-overflow: ellipsis;
          ">${displayName} - ${driver?.time}</div>
        `;

        // Click handler to select driver
        el.addEventListener("click", () => {
          popup.remove(); // keep popup hover-only
          setSelectedDriver(driver.id);
        });

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
        }).setHTML(`
          <div class="p-2">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
              </div>
              <div>
                <strong class="block">${driver.name},  ${driver.id}</strong>
                <span class="text-xs ${
                  isSelected ? "text-blue-600 font-bold" : "text-blue-600"
                }">${isSelected ? "SELECTED DRIVER" : "DRIVER"}, ${
          driver.time
        }</span>
              </div>
            </div>
            <p class="text-xs text-gray-600 mb-1"><strong>Location:</strong> ${
              driver.subPoint
            }</p>
            <p class="text-xs text-gray-600 mb-1"><strong>Phone:</strong> ${
              driver.phone
            }</p>
            <p class="text-xs text-gray-500 mb-2">${driver.address}</p>
            ${
              !isSelected
                ? '<p class="text-xs text-blue-600 font-medium cursor-pointer">Click marker to select</p>'
                : ""
            }
          </div>
        `);

        // Hover handlers to show/hide popup
        el.addEventListener("mouseenter", () => {
          popup.setLngLat(driver.coordinates).addTo(map.current!);
        });

        el.addEventListener("mouseleave", () => {
          popup.remove();
        });

        const marker = new mapboxgl.Marker(el)
          .setLngLat(driver.coordinates)
          .addTo(map.current!);

        markersRef.current.push(marker);
        return;
      }

      const groupEl = document.createElement("div");
      groupEl.style.display = "flex";
      groupEl.style.alignItems = "center";
      groupEl.style.justifyContent = "center";
      groupEl.style.cursor = "pointer";
      groupEl.innerHTML = `
        <div style="
          background-color: #f20505;
          color: white;
          font-size: 9px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        ">
          <span>Drivers</span>
          <span style="
            background: white;
            color: #f20505;
            font-size: 9px;
            font-weight: 700;
            padding: 0 4px;
            border-radius: 10px;
            line-height: 1.2;
          ">${driverCount}</span>
        </div>
      `;

      const createDriverCarouselHTML = () => {
        const carouselId = `driver-carousel-${coordKey.replace(/[.,]/g, "-")}`;
        const driversHTML = driversAtLocation
          .map((driver, index) => {
            const isSelected = driver.id === selectedDriver;
            return `
          <div class="carousel-slide" data-index="${index}" style="display: ${
              index === 0 ? "block" : "none"
            };">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
              </div>
              <div class="min-w-0 flex-1">
                <strong class="block truncate">${driver.name}, ${
              driver.id
            }</strong>
                <span class="text-xs ${
                  isSelected ? "text-blue-600 font-bold" : "text-blue-600"
                }">${isSelected ? "SELECTED DRIVER" : "DRIVER"}, ${
              driver.time || ""
            }</span>
              </div>
            </div>
            <p class="text-xs text-gray-600 mb-1"><strong>Location:</strong> ${
              driver.subPoint || "N/A"
            }</p>
            <p class="text-xs text-gray-600 mb-1"><strong>Phone:</strong> ${
              driver.phone || "N/A"
            }</p>
            <p class="text-xs text-gray-500 mb-2">${driver.address || ""}</p>
            <button class="driver-select px-2 py-1 text-xs rounded border ${
              isSelected
                ? "border-blue-200 text-blue-600 bg-blue-50"
                : "border-blue-600 text-blue-600 bg-white"
            }" data-driver-id="${driver.id}">
              ${isSelected ? "Selected" : "Select driver"}
            </button>
          </div>
        `;
          })
          .join("");

        return `
          <div class="p-2" style="min-width: 240px;">
            <div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
              <span class="text-xs font-bold text-blue-600">${driverCount} Drivers at this location</span>
            </div>
            <div id="${carouselId}" class="carousel-container">
              ${driversHTML}
            </div>
            <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
              <button class="carousel-prev px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors" data-carousel="${carouselId}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span class="carousel-indicator text-xs text-gray-500" data-carousel="${carouselId}">1 / ${driverCount}</span>
              <button class="carousel-next px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors" data-carousel="${carouselId}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        `;
      };

      const driverPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: "280px",
      }).setHTML(createDriverCarouselHTML());

      let currentSlide = 0;
      let closeTimeout: ReturnType<typeof setTimeout> | null = null;
      let isPopupOpen = false;

      const setupDriverCarouselEvents = () => {
        const carouselId = `driver-carousel-${coordKey.replace(/[.,]/g, "-")}`;
        const container = document.getElementById(carouselId);
        if (!container) return;

        const slides = container.querySelectorAll(".carousel-slide");
        const indicator = document.querySelector(
          `.carousel-indicator[data-carousel="${carouselId}"]`
        );
        const prevBtn = document.querySelector(
          `.carousel-prev[data-carousel="${carouselId}"]`
        );
        const nextBtn = document.querySelector(
          `.carousel-next[data-carousel="${carouselId}"]`
        );
        const selectButtons = container.querySelectorAll(
          ".driver-select[data-driver-id]"
        );

        const showSlide = (index: number) => {
          slides.forEach((slide, i) => {
            (slide as HTMLElement).style.display =
              i === index ? "block" : "none";
          });
          if (indicator) {
            indicator.textContent = `${index + 1} / ${driverCount}`;
          }
          currentSlide = index;
        };

        prevBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          const newIndex =
            currentSlide === 0 ? driverCount - 1 : currentSlide - 1;
          showSlide(newIndex);
        });

        nextBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          const newIndex =
            currentSlide === driverCount - 1 ? 0 : currentSlide + 1;
          showSlide(newIndex);
        });

        selectButtons.forEach((button) => {
          button.addEventListener("click", (e) => {
            e.stopPropagation();
            const target = e.currentTarget as HTMLElement;
            const driverId = target.getAttribute("data-driver-id");
            if (!driverId) return;
            setSelectedDriver(driverId);
          });
        });

        const popupEl = driverPopup.getElement();
        if (popupEl) {
          popupEl.addEventListener("mouseenter", () => {
            if (closeTimeout) {
              clearTimeout(closeTimeout);
              closeTimeout = null;
            }
          });

          popupEl.addEventListener("mouseleave", () => {
            closeTimeout = setTimeout(() => {
              driverPopup.remove();
              isPopupOpen = false;
            }, 100);
          });
        }
      };

      groupEl.addEventListener("mouseenter", () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        if (!isPopupOpen) {
          currentSlide = 0;
          driverPopup.setHTML(createDriverCarouselHTML());
          driverPopup.setLngLat(coordinates).addTo(map.current!);
          isPopupOpen = true;
          setTimeout(setupDriverCarouselEvents, 0);
        }
      });

      groupEl.addEventListener("mouseleave", () => {
        closeTimeout = setTimeout(() => {
          driverPopup.remove();
          isPopupOpen = false;
        }, 150);
      });

      const groupMarker = new mapboxgl.Marker(groupEl)
        .setLngLat(coordinates)
        .addTo(map.current!);

      markersRef.current.push(groupMarker);
    });

    // Add filtered + queued passenger markers with unique colors (work and home locations)
    const passengerIdSet = new Set(
      filteredPassengers.map((p) => String(p.id))
    );
    const passengersToShow = [
      ...filteredPassengers,
      ...queuedPassengerLocations.filter(
        (passenger) => !passengerIdSet.has(String(passenger.id))
      ),
    ];

    const workGroups = new Map<string, Location[]>();
    passengersToShow.forEach((passenger) => {
      const coordKey = `${passenger.coordinates[0]},${passenger.coordinates[1]}`;
      if (!workGroups.has(coordKey)) {
        workGroups.set(coordKey, []);
      }
      workGroups.get(coordKey)!.push(passenger);
    });

    workGroups.forEach((passengersAtWork, coordKey) => {
      const [lng, lat] = coordKey.split(",").map(Number);
      const coordinates: [number, number] = [lng, lat];
      const passengerCount = passengersAtWork.length;

      if (passengerCount === 1) {
        const passenger = passengersAtWork[0];
        const isSelected = selectedPassengers
          .map((s) => String(s))
          .includes(String(passenger.id));
        const isQueued = queuedPassengerIds.has(String(passenger.id));

        // Format time for display (show only HH:MM)
        const displayTime = passenger.time ? passenger.time.slice(0, 5) : "";

        // Add work location marker (Building icon) with time label
        const workEl = document.createElement("div");
        workEl.style.display = "flex";
        workEl.style.flexDirection = "column";
        workEl.style.alignItems = "center";
        workEl.style.cursor = isQueued ? "not-allowed" : "pointer";
        workEl.style.transition = "all 0.2s";
        const isDummy = String(passenger.id).startsWith("DUMMY-");
        const queuedPassengerColor = queuedPassengerColorMap.get(String(passenger.id));
        const workTimeBg = queuedPassengerColor || "#036ffc";
        const workBgColor =
          queuedPassengerColor ||
          (isDummy
            ? isSelected
              ? "#000"
              : "#000"
            : isSelected
            ? "#3b82f5"
            : "#629dfc");
        workEl.innerHTML = `
        <div style="
          width: ${isSelected ? "32px" : "24px"};
          height: ${isSelected ? "32px" : "24px"};
          border-radius: 50%;
          background-color: ${workBgColor};
          border: ${isSelected ? "3px solid white" : "2px solid white"};
          box-shadow: ${
            isSelected
              ? "0 4px 8px rgba(0,0,0,0.3)"
              : "0 2px 4px rgba(0,0,0,0.2)"
          };
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="${
            isSelected ? "16" : "12"
          }" height="${
          isSelected ? "16" : "12"
        }" viewBox="0 0 24 24" fill="white"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
        </div>
          ${
          displayTime
            ? `<div style="
          background-color: ${workTimeBg};
          color: white;
          font-size: 9px;
          font-weight: 600;
          padding: 2px 5px;
          border-radius: 4px;
          margin-top: 2px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">${displayTime}</div>`
            : ""
        }`;

        if (!isQueued) {
          workEl.addEventListener("click", () => {
            workPopup.remove();
            togglePassenger(passenger.id);
          });
        }

        const workPopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
        }).setHTML(`
          <div class="p-2">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div>
                <strong class="block">${passenger.name}, ${
          passenger.id
        }</strong>
                <span class="text-xs ${
                  isSelected ? "text-green-600 font-bold" : "text-green-600"
                }">${isSelected ? "SELECTED PICKUP" : "PICKUP"}, ${
          passenger.time || ""
        }</span>
              </div>
            </div>
            <p class="text-xs text-gray-600 mb-1"><strong>Location:</strong> ${
              passenger.subPoint || "N/A"
            }</p>
            <p class="text-xs text-gray-600 mb-1"><strong>Phone:</strong> ${
              passenger.phone
            }</p>
            <p class="text-xs text-gray-500 mb-2">${passenger.address || ""}</p>
            <p class="text-xs text-gray-500 mb-2"><strong>Drop Location:</strong> ${
              passenger.destination || ""
            }</p>
            ${
              passenger.destinationSubPoint
                ? `<p class="text-xs text-orange-600 font-medium"><strong>Destination:</strong> ${passenger.destinationSubPoint}</p>`
                : ""
            }
            ${
              isQueued
                ? '<p class="text-xs text-gray-500 font-medium mt-1">Already queued</p>'
                : !isSelected
                  ? '<p class="text-xs text-green-600 font-medium cursor-pointer mt-1">Click marker to select</p>'
                  : ""
            }
          </div>
        `);

        // Hover handlers to show/hide popup
        workEl.addEventListener("mouseenter", () => {
          workPopup.setLngLat(passenger.coordinates).addTo(map.current!);
        });

        workEl.addEventListener("mouseleave", () => {
          workPopup.remove();
        });

        const workMarker = new mapboxgl.Marker(workEl)
          .setLngLat(passenger.coordinates)
          .addTo(map.current!);

        markersRef.current.push(workMarker);
        return;
      }

      const allDummy = passengersAtWork.every((p) =>
        String(p.id).startsWith("DUMMY-")
      );
      const workEl = document.createElement("div");
      workEl.style.width = "32px";
      workEl.style.height = "32px";
      workEl.style.borderRadius = "50%";
      workEl.style.backgroundColor = allDummy ? "#000000" : "#3b82f5";
      workEl.style.border = "3px solid white";
      workEl.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
      workEl.style.display = "flex";
      workEl.style.alignItems = "center";
      workEl.style.justifyContent = "center";
      workEl.style.cursor = "pointer";
      workEl.style.position = "relative";
      workEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
        <div style="position: absolute; top: -6px; right: -6px; background: #0f172a; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white;">${passengerCount}</div>
      `;

      const createWorkCarouselHTML = () => {
        const carouselId = `return-work-carousel-${coordKey.replace(
          /[.,]/g,
          "-"
        )}`;
        const allPassengerIds = passengersAtWork.map((p) => String(p.id));
        const selectablePassengerIds = allPassengerIds.filter(
          (id) => !queuedPassengerIds.has(id)
        );
        const allSelected =
          selectablePassengerIds.length > 0 &&
          selectablePassengerIds.every((id) =>
            selectedPassengers.map((s) => String(s)).includes(id)
          );
        const passengersHTML = passengersAtWork
          .map((passenger, index) => {
            const isSelected = selectedPassengers
              .map((s) => String(s))
              .includes(String(passenger.id));
            const isQueued = queuedPassengerIds.has(String(passenger.id));
            return `
          <div class="carousel-slide" data-index="${index}" style="display: ${
              index === 0 ? "block" : "none"
            };">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
              </div>
              <div class="min-w-0 flex-1">
                <strong class="block truncate">${passenger.name}, ${
              passenger.id
            }</strong>
                <span class="text-xs ${
                  isSelected ? "text-green-600 font-bold" : "text-green-600"
                }">${isSelected ? "SELECTED - WORK" : "WORK LOCATION"}, ${
              passenger.time || ""
            }</span>
              </div>
            </div>
            <p class="text-xs text-gray-600 mb-1"><strong>Pickup:</strong> ${
              passenger.subPoint || "N/A"
            }</p>
            <p class="text-xs text-gray-500 truncate">${
              passenger.address || ""
            }</p>
            ${
              isQueued
                ? `<span class="px-2 py-1 text-xs rounded border border-gray-200 text-gray-500">Queued</span>`
                : `<button class="passenger-toggle px-2 py-1 text-xs rounded border ${
                    isSelected
                      ? "border-green-200 text-green-700 bg-green-50"
                      : "border-green-600 text-green-600 bg-white"
                  }" data-passenger-id="${passenger.id}" data-selected="${
                    isSelected ? "true" : "false"
                  }" data-queued="false">
                    ${isSelected ? "Remove passenger" : "Select passenger"}
                  </button>`
            }
          </div>
        `;
          })
          .join("");

        return `
          <div class="p-2" style="min-width: 260px;">
            <div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
              <span class="text-xs font-bold text-green-600">${passengerCount} Passengers at this location</span>
              ${
                selectablePassengerIds.length > 0
                  ? `<button class="select-all-passengers px-2 py-1 text-xs rounded border ${
                      allSelected
                        ? "border-green-200 text-green-700 bg-green-50"
                        : "border-green-600 text-green-600 bg-white hover:bg-green-50"
                    }" data-passenger-ids="${selectablePassengerIds.join(
                      ","
                    )}" data-all-selected="${allSelected}">
                      ${allSelected ? "Deselect all" : "Select all"}
                    </button>`
                  : `<span class="text-xs text-gray-500">All queued</span>`
              }
            </div>
            <div id="${carouselId}" class="carousel-container">
              ${passengersHTML}
            </div>
            <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
              <button class="carousel-prev px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors" data-carousel="${carouselId}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span class="carousel-indicator text-xs text-gray-500" data-carousel="${carouselId}">1 / ${passengerCount}</span>
              <button class="carousel-next px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors" data-carousel="${carouselId}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        `;
      };

      const workPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: "300px",
      }).setHTML(createWorkCarouselHTML());

      let currentSlide = 0;
      let closeTimeout: ReturnType<typeof setTimeout> | null = null;
      let isPopupOpen = false;

      const setupWorkCarouselEvents = () => {
        const carouselId = `return-work-carousel-${coordKey.replace(
          /[.,]/g,
          "-"
        )}`;
        const container = document.getElementById(carouselId);
        if (!container) return;

        const slides = container.querySelectorAll(".carousel-slide");
        const indicator = document.querySelector(
          `.carousel-indicator[data-carousel="${carouselId}"]`
        );
        const prevBtn = document.querySelector(
          `.carousel-prev[data-carousel="${carouselId}"]`
        );
        const nextBtn = document.querySelector(
          `.carousel-next[data-carousel="${carouselId}"]`
        );

        const showSlide = (index: number) => {
          slides.forEach((slide, i) => {
            (slide as HTMLElement).style.display =
              i === index ? "block" : "none";
          });
          if (indicator) {
            indicator.textContent = `${index + 1} / ${passengerCount}`;
          }
          currentSlide = index;
        };

        prevBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          const newIndex =
            currentSlide === 0 ? passengerCount - 1 : currentSlide - 1;
          showSlide(newIndex);
        });

        nextBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          const newIndex =
            currentSlide === passengerCount - 1 ? 0 : currentSlide + 1;
          showSlide(newIndex);
        });

        const popupEl = workPopup.getElement();
        if (popupEl) {
          popupEl.addEventListener("mouseenter", () => {
            if (closeTimeout) {
              clearTimeout(closeTimeout);
              closeTimeout = null;
            }
          });

          popupEl.addEventListener("mouseleave", () => {
            closeTimeout = setTimeout(() => {
              workPopup.remove();
              isPopupOpen = false;
            }, 100);
          });
        }
      };

      workEl.addEventListener("mouseenter", () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        if (!isPopupOpen) {
          currentSlide = 0;
          workPopup.setHTML(createWorkCarouselHTML());
          workPopup.setLngLat(coordinates).addTo(map.current!);
          isPopupOpen = true;
          setTimeout(setupWorkCarouselEvents, 0);
        }
      });

      workEl.addEventListener("mouseleave", () => {
        closeTimeout = setTimeout(() => {
          workPopup.remove();
          isPopupOpen = false;
        }, 150);
      });

      const workMarker = new mapboxgl.Marker(workEl)
        .setLngLat(coordinates)
        .addTo(map.current!);

      markersRef.current.push(workMarker);
    });

    const homeGroups = new Map<string, Location[]>();
    const dropPassengerIds = new Set<string>();
    const addDropPassenger = (passenger: Location) => {
      if (!passenger.destinationCoordinates) return;
      const passengerId = String(passenger.id);
      if (dropPassengerIds.has(passengerId)) return;
      dropPassengerIds.add(passengerId);
      const coordKey = `${passenger.destinationCoordinates[0]},${passenger.destinationCoordinates[1]}`;
      if (!homeGroups.has(coordKey)) {
        homeGroups.set(coordKey, []);
      }
      homeGroups.get(coordKey)!.push(passenger);
    };

    passengersToShow.forEach((passenger) => addDropPassenger(passenger));
    queuedDestinationPassengers.forEach((passenger) => addDropPassenger(passenger));

    homeGroups.forEach((passengersAtHome, coordKey) => {
      const [lng, lat] = coordKey.split(",").map(Number);
      const coordinates: [number, number] = [lng, lat];
      const passengerCount = passengersAtHome.length;

      if (passengerCount === 1) {
        const passenger = passengersAtHome[0];
        const isSelected = selectedPassengers
          .map((s) => String(s))
          .includes(String(passenger.id));
        const isQueued = queuedPassengerIds.has(String(passenger.id));
        const displayTime = passenger.time ? passenger.time.slice(0, 5) : "";

        const homeEl = document.createElement("div");
        homeEl.style.display = "flex";
        homeEl.style.flexDirection = "column";
        homeEl.style.alignItems = "center";
        homeEl.style.cursor = isQueued ? "not-allowed" : "pointer";
        homeEl.style.transition = "all 0.2s";

        const isDummyHome = String(passenger.id).startsWith("DUMMY-");
        const queuedPassengerColor = queuedPassengerColorMap.get(
          String(passenger.id)
        );
        const homeTimeBg = queuedPassengerColor || "#036ffc";
        const homeBgColor =
          queuedPassengerColor ||
          (isDummyHome ? "#000000" : isSelected ? "#3b82f5" : "#629dfc");
        homeEl.innerHTML = `
          <div style="
            width: ${isSelected ? "28px" : "22px"};
            height: ${isSelected ? "28px" : "22px"};
            border-radius: 50%;
            background-color: ${homeBgColor};
            border: ${isSelected ? "3px solid white" : "2px solid white"};
            box-shadow: ${
              isSelected
                ? "0 4px 8px rgba(0,0,0,0.3)"
                : "0 2px 4px rgba(0,0,0,0.2)"
            };
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: ${isSelected ? "1" : "0.75"};
            position: relative;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="${
              isSelected ? "14" : "10"
            }" height="${
          isSelected ? "14" : "10"
        }" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          </div>
          ${
            displayTime
              ? `<div style="
            background-color: ${homeTimeBg};
            color: white;
            font-size: 9px;
            font-weight: 600;
            padding: 2px 5px;
            border-radius: 4px;
            margin-top: 2px;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          ">${displayTime}</div>`
              : ""
          }`;

        if (!isQueued) {
          homeEl.addEventListener("click", () => {
            homePopup.remove(); // hover-only popup
            togglePassenger(passenger.id);
          });
        }

        const homePopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
        }).setHTML(`
          <div class="p-2">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
              <div>
                <strong class="block">${passenger.name}, ${
          passenger.id
        }</strong>
                <span class="text-xs ${
                  isSelected ? "text-green-600 font-bold" : "text-green-600"
                }">${isSelected ? "SELECTED DROP" : "DROP"}, ${
          passenger.time || ""
        }</span>
              </div>
            </div>
            <p class="text-xs text-gray-600 mb-1"><strong>Location:</strong> ${
              passenger.destinationSubPoint || "N/A"
            }</p>
            <p class="text-xs text-gray-600 mb-1"><strong>Phone:</strong> ${
              passenger.phone
            }</p>
            <p class="text-xs text-gray-500 mb-2">${
              passenger.destination || ""
            }</p>
            <p class="text-xs text-gray-500 mb-2"><strong>Pickup Location:</strong> ${
              passenger.address || ""
            }</p>
            ${
              passenger.subPoint
                ? `<p class="text-xs text-orange-600 font-medium"><strong>Pickup:</strong> ${passenger.subPoint}</p>`
                : ""
            }
            ${
              isQueued
                ? '<p class="text-xs text-gray-500 font-medium mt-1">Already queued</p>'
                : !isSelected
                  ? '<p class="text-xs text-green-600 font-medium cursor-pointer mt-1">Click marker to select</p>'
                  : ""
            }
          </div>
        `);

        // Hover handlers to show/hide popup
        homeEl.addEventListener("mouseenter", () => {
          homePopup.setLngLat(coordinates).addTo(map.current!);
        });

        homeEl.addEventListener("mouseleave", () => {
          homePopup.remove();
        });

        const homeMarker = new mapboxgl.Marker(homeEl)
          .setLngLat(coordinates)
          .addTo(map.current!);

        markersRef.current.push(homeMarker);
        return;
      }

      const allDummyHome = passengersAtHome.every((p) =>
        String(p.id).startsWith("DUMMY-")
      );
      const queuedHomeColor = passengersAtHome
        .map((p) => queuedPassengerColorMap.get(String(p.id)))
        .find(Boolean);
      const homeEl = document.createElement("div");
      homeEl.style.width = "28px";
      homeEl.style.height = "28px";
      homeEl.style.borderRadius = "50%";
      homeEl.style.backgroundColor =
        queuedHomeColor ?? (allDummyHome ? "#000000" : "#629dfc");
      homeEl.style.border = "3px solid white";
      homeEl.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
      homeEl.style.display = "flex";
      homeEl.style.alignItems = "center";
      homeEl.style.justifyContent = "center";
      homeEl.style.cursor = "pointer";
      homeEl.style.position = "relative";
      homeEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        <div style="position: absolute; top: -6px; right: -6px; background: #0f172a; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white;">${passengerCount}</div>
      `;

      const createHomeCarouselHTML = () => {
        const carouselId = `return-home-carousel-${coordKey.replace(
          /[.,]/g,
          "-"
        )}`;
        const allPassengerIds = passengersAtHome.map((p) => String(p.id));
        const selectablePassengerIds = allPassengerIds.filter(
          (id) => !queuedPassengerIds.has(id)
        );
        const allSelected =
          selectablePassengerIds.length > 0 &&
          selectablePassengerIds.every((id) =>
            selectedPassengers.map((s) => String(s)).includes(id)
          );
        const passengersHTML = passengersAtHome
          .map((passenger, index) => {
            const isSelected = selectedPassengers
              .map((s) => String(s))
              .includes(String(passenger.id));
            const isQueued = queuedPassengerIds.has(String(passenger.id));
            return `
          <div class="carousel-slide" data-index="${index}" style="display: ${
              index === 0 ? "block" : "none"
            };">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
              <div class="min-w-0 flex-1">
                <strong class="block truncate">${passenger.name}, ${
              passenger.id
            }</strong>
                <span class="text-xs ${
                  isSelected ? "text-green-600 font-bold" : "text-green-600"
                }">${isSelected ? "SELECTED - HOME" : "HOME DESTINATION"}, ${
              passenger.time || ""
            }</span>
              </div>
            </div>
            <p class="text-xs text-gray-600 mb-1"><strong>Home:</strong> ${
              passenger.destinationSubPoint || "N/A"
            }</p>
            <p class="text-xs text-gray-500 truncate">${
              passenger.destination || ""
            }</p>
            ${
              isQueued
                ? `<span class="px-2 py-1 text-xs rounded border border-gray-200 text-gray-500">Queued</span>`
                : `<button class="passenger-toggle px-2 py-1 text-xs rounded border ${
                    isSelected
                      ? "border-green-200 text-green-700 bg-green-50"
                      : "border-green-600 text-green-600 bg-white"
                  }" data-passenger-id="${passenger.id}" data-selected="${
                    isSelected ? "true" : "false"
                  }" data-queued="false">
                    ${isSelected ? "Remove passenger" : "Select passenger"}
                  </button>`
            }
          </div>
        `;
          })
          .join("");

        return `
          <div class="p-2" style="min-width: 260px;">
            <div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
              <span class="text-xs font-bold text-green-600">${passengerCount} Passengers at this location</span>
              ${
                selectablePassengerIds.length > 0
                  ? `<button class="select-all-home-passengers px-2 py-1 text-xs rounded border ${
                      allSelected
                        ? "border-green-200 text-green-700 bg-green-50"
                        : "border-green-600 text-green-600 bg-white hover:bg-green-50"
                    }" data-passenger-ids="${selectablePassengerIds.join(
                      ","
                    )}" data-all-selected="${allSelected}">
                      ${allSelected ? "Deselect all" : "Select all"}
                    </button>`
                  : `<span class="text-xs text-gray-500">All queued</span>`
              }
            </div>
            <div id="${carouselId}" class="carousel-container">
              ${passengersHTML}
            </div>
            <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
              <button class="carousel-prev px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors" data-carousel="${carouselId}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span class="carousel-indicator text-xs text-gray-500" data-carousel="${carouselId}">1 / ${passengerCount}</span>
              <button class="carousel-next px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors" data-carousel="${carouselId}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        `;
      };

      const homePopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: "300px",
      }).setHTML(createHomeCarouselHTML());

      let currentSlide = 0;
      let closeTimeout: ReturnType<typeof setTimeout> | null = null;
      let isPopupOpen = false;

      const setupHomeCarouselEvents = () => {
        const carouselId = `return-home-carousel-${coordKey.replace(
          /[.,]/g,
          "-"
        )}`;
        const container = document.getElementById(carouselId);
        if (!container) return;

        const slides = container.querySelectorAll(".carousel-slide");
        const indicator = document.querySelector(
          `.carousel-indicator[data-carousel="${carouselId}"]`
        );
        const prevBtn = document.querySelector(
          `.carousel-prev[data-carousel="${carouselId}"]`
        );
        const nextBtn = document.querySelector(
          `.carousel-next[data-carousel="${carouselId}"]`
        );

        const showSlide = (index: number) => {
          slides.forEach((slide, i) => {
            (slide as HTMLElement).style.display =
              i === index ? "block" : "none";
          });
          if (indicator) {
            indicator.textContent = `${index + 1} / ${passengerCount}`;
          }
          currentSlide = index;
        };

        prevBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          const newIndex =
            currentSlide === 0 ? passengerCount - 1 : currentSlide - 1;
          showSlide(newIndex);
        });

        nextBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          const newIndex =
            currentSlide === passengerCount - 1 ? 0 : currentSlide + 1;
          showSlide(newIndex);
        });

        const popupEl = homePopup.getElement();
        if (popupEl) {
          popupEl.addEventListener("mouseenter", () => {
            if (closeTimeout) {
              clearTimeout(closeTimeout);
              closeTimeout = null;
            }
          });

          popupEl.addEventListener("mouseleave", () => {
            closeTimeout = setTimeout(() => {
              homePopup.remove();
              isPopupOpen = false;
            }, 100);
          });
        }
      };

      homeEl.addEventListener("mouseenter", () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        if (!isPopupOpen) {
          currentSlide = 0;
          homePopup.setHTML(createHomeCarouselHTML());
          homePopup.setLngLat(coordinates).addTo(map.current!);
          isPopupOpen = true;
          setTimeout(setupHomeCarouselEvents, 0);
        }
      });

      homeEl.addEventListener("mouseleave", () => {
        closeTimeout = setTimeout(() => {
          homePopup.remove();
          isPopupOpen = false;
        }, 150);
      });

      const homeMarker = new mapboxgl.Marker(homeEl)
        .setLngLat(coordinates)
        .addTo(map.current!);

      markersRef.current.push(homeMarker);
    });

    // Auto-fit map to show all markers
    if (markersRef.current.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();

      // Add filtered driver coordinates
      filteredDrivers.forEach((driver) => bounds.extend(driver.coordinates));

      // Add all filtered passenger work and home coordinates
      filteredPassengers.forEach((passenger) => {
        bounds.extend(passenger.coordinates);
        if (passenger.destinationCoordinates) {
          bounds.extend(passenger.destinationCoordinates);
        }
      });

      map.current.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    }

    if (currentDriver && currentPassengers.length > 0) {
      calculateRoute();
      setShowBottomPanel(true);
    } else {
      if (map.current.getLayer("route")) {
        map.current.removeLayer("route");
        map.current.removeSource("route");
      }
      setRouteInfo(null);
      setShowBottomPanel(false);
    }
  };

  const calculateRoute = async () => {
    if (!currentDriver || currentPassengers.length === 0 || !map.current)
      return;

    setIsCalculating(true);

    try {
      // Function to calculate distance between two coordinates (Haversine formula)
      const getDistance = (
        coord1: [number, number],
        coord2: [number, number]
      ): number => {
        const [lon1, lat1] = coord1;
        const [lon2, lat2] = coord2;
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // Optimize route order using nearest neighbor algorithm
      const optimizeRoute = (
        start: [number, number],
        locations: [number, number][]
      ): [number, number][] => {
        if (locations.length === 0) return [];
        if (locations.length === 1) return locations;

        const optimized: [number, number][] = [];
        const remaining = [...locations];
        let current = start;

        while (remaining.length > 0) {
          // Find nearest location to current position
          let nearestIndex = 0;
          let nearestDistance = getDistance(current, remaining[0]);

          for (let i = 1; i < remaining.length; i++) {
            const distance = getDistance(current, remaining[i]);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestIndex = i;
            }
          }

          // Add nearest to optimized route and remove from remaining
          optimized.push(remaining[nearestIndex]);
          current = remaining[nearestIndex];
          remaining.splice(nearestIndex, 1);
        }

        return optimized;
      };

      // Separate pickups (from work) and dropoffs (to home)
      const pickupCoordinates = currentPassengers.map((p) => p.coordinates); // Work locations
      const dropoffCoordinates = currentPassengers
        .filter((p) => p.destinationCoordinates)
        .map((p) => p.destinationCoordinates!); // Home locations

      // Optimize pickup order starting from driver location
      const optimizedPickups = optimizeRoute(
        currentDriver.coordinates,
        pickupCoordinates
      );

      // Optimize dropoff order starting from last pickup location
      const lastPickupLocation =
        optimizedPickups.length > 0
          ? optimizedPickups[optimizedPickups.length - 1]
          : currentDriver.coordinates;
      const optimizedDropoffs = optimizeRoute(
        lastPickupLocation,
        dropoffCoordinates
      );

      // Build complete optimized route
      const allWaypoints = [
        currentDriver.coordinates,
        ...optimizedPickups,
        ...optimizedDropoffs,
      ];

      // Get the full route geometry from Mapbox Directions API
      const coordinatesStr = allWaypoints.map((c) => c.join(",")).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesStr}?geometries=geojson&overview=full&steps=true&access_token=${mapboxgl.accessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMin = route.duration / 60;

        setRouteInfo({
          distance: distanceKm,
          duration: durationMin,
          route: route.geometry,
        });

        // Draw the route on the map
        if (map.current.getSource("route")) {
          (map.current.getSource("route") as mapboxgl.GeoJSONSource).setData(
            route.geometry
          );
        } else {
          map.current.addSource("route", {
            type: "geojson",
            data: route.geometry,
          });

          map.current.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": routeColors[routeColorIndex].primary,
              "line-width": 5,
              "line-opacity": 0.8,
              "line-dasharray": [1, 0],
            },
          });
        }

        // Fit map to show entire route
        const bounds = new mapboxgl.LngLatBounds();
        allWaypoints.forEach((coord) =>
          bounds.extend(coord as [number, number])
        );
        map.current.fitBounds(bounds, { padding: 80 });
      }
    } catch (error) {
      console.error("Error calculating route:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  const togglePassenger = (passengerId: string | number) => {
    const id = String(passengerId);
    const currentStrings = selectedPassengers.map((s) => String(s));
    const newPassengers = currentStrings.includes(id)
      ? currentStrings.filter((s) => s !== id)
      : [...currentStrings, id];
    setSelectedPassengers(newPassengers);
  };

  const clearSelections = () => {
    setSelectedDriver(null);
    setSelectedPassengers([]);
    setRouteInfo(null);
    setShowBottomPanel(false);
    dispatch(setReturnEditingRouteId(null));
  };

  const handleClearDataClick = () => {
    setShowClearDialog(true);
  };

  const handleConfirmClear = () => {
    // Clear only the data for current date and shift
    dispatch(
      clearRouteData({
        routeType: "return",
        shift: normalizedShift,
        date: selectedDate,
      })
    );
    // Clear local state
    setDriversData([]);
    setPassengersData([]);
    clearSelections();
    setPendingRoutes([]);
    setShowClearDialog(false);
  };

  const handleCancelClear = () => {
    setShowClearDialog(false);
  };

  const buildReturnDummyPassenger = (
    row: (typeof dummyPassengerRows)[number],
    offset: number
  ): ShiftPassenger => {
    const index = returnDummyPassengerCount + offset + 1;
    const homeLat = parseCoordinate(row.homeLat);
    const homeLog = parseCoordinate(row.homeLog);
    const pickupLat = homeLat;
    const pickupLog = homeLog;

    return {
      USER_ID: `DUMMY-${index}-${Date.now()}`,
      SHIFT: selectedShift,
      DATE: selectedDate,
      TIME: "",
      NAME: `Dummy Passenger ${index}`,
      MOBILE: "0000000000",
      PICKUP_LOCATION: "Factory",
      PICKUP_LAT: pickupLat,
      PICKUP_LOG: pickupLog,
      PICKUP_SUBPOINT: "Factory Area",
      DROP_LOCATION: "Dummy Drop Location",
      DROP_LAT: pickupLat,
      DROP_LOG: pickupLog,
      DROP_SUBPOINT: "Home Area",
    };
  };

  const removeDummyPassengerRow = (id: string) => {
    setDummyPassengerRows((prev) =>
      prev.length === 1 ? prev : prev.filter((row) => row.id !== id)
    );
  };

  const handleAddDummyPassengers = () => {
    const newPassengers = dummyPassengerRows.map((row, index) =>
      buildReturnDummyPassenger(row, index)
    );
    setPassengersData((prev) => [...prev, ...newPassengers]);
    setReturnDummyPassengerCount((prev) => prev + newPassengers.length);
    setShowDummyPassengerModal(false);
    setDummyPassengerRows([createEmptyRow()]);
  };

  const handleRemoveReturnDummyPassengers = () => {
    setPassengersData((prev) =>
      prev.filter(
        (passenger) => !String(passenger.USER_ID).startsWith("DUMMY-")
      )
    );
    const cleanedSelections = selectedPassengers.filter(
      (id) => !String(id).startsWith("DUMMY-")
    );
    dispatch(setReturnPassengers(cleanedSelections));
    setReturnDummyPassengerCount(0);
  };

  const changeRouteColor = () => {
    const nextIndex = (routeColorIndex + 1) % routeColors.length;
    setRouteColorIndex(nextIndex);

    if (map.current && map.current.getLayer("route")) {
      map.current.setPaintProperty(
        "route",
        "line-color",
        routeColors[nextIndex].primary
      );
    }
  };

  const getDefaultRouteName = () =>
    `RR ${returnRoutes.length + pendingRoutes.length + 1}`;

  const buildRoutePayload = ({
    overrideName,
    overrideColor,
  }: {
    overrideName?: string;
    overrideColor?: { primary: string; name: string };
  } = {}): SavedRoute | null => {
    if (!selectedDriver || selectedPassengers.length === 0 || !routeInfo) {
      return null;
    }

    const driverSnapshot = currentDriver
      ? toParticipantSnapshot(currentDriver)
      : undefined;
    const passengerSnapshots = currentPassengers.map(toParticipantSnapshot);

    return {
      id: `route-${Date.now()}`,
      name: overrideName ?? getDefaultRouteName(),
      driverId: selectedDriver,
      passengerIds: selectedPassengers.map((id) => String(id)),
      routeInfo,
      color: overrideColor ?? routeColors[routeColorIndex],
      visible: true,
      createdAt: new Date().toISOString(),
      routeType: "return",
      driverSnapshot,
      passengerSnapshots,
      date: selectedDate,
      shift: selectedShift,
    };
  };

  const applyQueuedRouteForEditing = (route: SavedRoute) => {
    const colorIndex = routeColors.findIndex(
      (c) => c.primary === route.color.primary
    );
    setRouteColorIndex(colorIndex >= 0 ? colorIndex : 0);
    setSelectedDriver(route.driverId ?? null);
    setSelectedPassengers(route.passengerIds.map((id) => String(id)));
    setRouteInfo(route.routeInfo);
    setShowBottomPanel(true);
    setPendingRoutes((prev) => prev.filter((r) => r.id !== route.id));
    setEditingQueuedRoute({
      id: route.id,
      name: route.name,
      color: route.color,
    });
  };

  const queueRoute = () => {
    if (editingRouteId) return;
    const queuedRoute = buildRoutePayload({
      overrideName: editingQueuedRoute?.name,
      overrideColor: editingQueuedRoute?.color,
    });
    if (!queuedRoute) return;
    setPendingRoutes((prev) => [...prev, queuedRoute]);
    clearSelections();
    setRouteColorIndex((prev) => (prev + 1) % routeColors.length);
    if (editingQueuedRoute) {
      setEditingQueuedRoute(null);
    }
  };

  const removePendingRoute = (routeId: string) => {
    setPendingRoutes((prev) => prev.filter((route) => route.id !== routeId));
  };

  const flushPendingRoutes = () => {
    if (pendingRoutes.length === 0) {
      return;
    }
    dispatch(
      saveRouteData({
        routeType: "return",
        shift: normalizedShift,
        date: selectedDate,
        drivers: driversData,
        passengers: passengersData,
      })
    );
    pendingRoutes.forEach((route) => onSaveRoute(route));
    setPendingRoutes([]);
  };

  const canQueueRoute =
    !editingRouteId &&
    Boolean(selectedDriver) &&
    selectedPassengers.length > 0 &&
    Boolean(routeInfo);

  const renderQueuedRoutes = () => {
    if (!map.current) return;

    queuedLayerIdsRef.current.forEach((layerId) => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
      if (map.current!.getSource(layerId)) {
        map.current!.removeSource(layerId);
      }
    });
    queuedLayerIdsRef.current.clear();

    pendingRoutes.forEach((route) => {
      const layerId = `queued-route-return-${route.id}`;
      queuedLayerIdsRef.current.add(layerId);

      if (!map.current!.getSource(layerId)) {
        map.current!.addSource(layerId, {
          type: "geojson",
          data: route.routeInfo.route,
        });
      } else {
        (map.current!.getSource(layerId) as mapboxgl.GeoJSONSource).setData(
          route.routeInfo.route
        );
      }

      map.current!.addLayer({
        id: layerId,
        type: "line",
        source: layerId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": route.color.primary,
          "line-width": 5,
          "line-opacity": 0.6,
          "line-dasharray": [1, 0],
        },
      });
    });
  };

  useEffect(() => {
    if (!map.current) return;

    if (!map.current.isStyleLoaded()) {
      map.current.once("load", () => {
        renderQueuedRoutes();
      });
      return;
    }

    renderQueuedRoutes();
  }, [pendingRoutes]);

  const saveRoute = () => {
    const editingRoute = editingRouteId
      ? storedRoutes.find((r) => r.id === editingRouteId)
      : undefined;

    const newRoute = buildRoutePayload({
      overrideName: editingRoute ? editingRoute.name : undefined,
      overrideColor: editingRoute ? editingRoute.color : undefined,
    });
    if (!newRoute) {
      return;
    }

    if (editingRouteId) {
      dispatch(deleteRoute(editingRouteId));
    }
    dispatch(
      saveRouteData({
        routeType: "return",
        shift: normalizedShift,
        date: selectedDate,
        drivers: driversData,
        passengers: passengersData,
      })
    );
    onSaveRoute(newRoute);
    clearSelections();
  };

  // Map navigation functions
  const handleZoomIn = () => {
    if (map.current) {
      map.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map.current) {
      map.current.zoomOut();
    }
  };

  const handleResetView = () => {
    if (map.current) {
      if (markersRef.current.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        drivers.forEach((driver) => bounds.extend(driver.coordinates));
        passengers.forEach((passenger) => {
          bounds.extend(passenger.coordinates);
          if (passenger.destinationCoordinates) {
            bounds.extend(passenger.destinationCoordinates);
          }
        });
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 12 });
      } else {
        map.current.flyTo({ center: [-80.4925, 43.4516], zoom: 10 });
      }
    }
  };

  const fetchRouteParticipants = async () => {
    const requestDate = selectedDate;
    const requestShift = normalizedShift;
    const isStaleRequest = () =>
      requestDate !== selectedDate ||
      requestShift !== normalizeShift(selectedShift);
    try {
      setDriversLoading(true);
      setPassengersLoading(true);
      setDriversError(null);
      setPassengersError(null);

      const formattedDate = formatDateForApi(requestDate);
      const shift = requestShift.toLowerCase();

      const [driversResult, passengersResult] = await Promise.all([
        driversService.getDriversByShift(formattedDate, routeType, shift),
        passengersService.getPassengersByShiftDateRoute(
          requestDate,
          routeType,
          shift
        ),
      ]);

      if (isStaleRequest()) {
        return;
      }

      setDriversData(Array.isArray(driversResult) ? driversResult : []);
      setPassengersData(
        Array.isArray(passengersResult) ? passengersResult : []
      );
    } catch (error: any) {
      if (isStaleRequest()) {
        return;
      }
      const message = error?.message || "Failed to fetch data";
      setDriversError(message);
      setPassengersError(message);
    } finally {
      setDriversLoading(false);
      setPassengersLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b shadow-sm z-30 relative">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2">
          <div className="flex items-center gap-2">
            {/* Date Selector */}
            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  setShowDateDropdown(!showDateDropdown);
                  setShowShiftDropdown(false);
                  setShowDriverDropdown(false);
                  setShowPassengerDropdown(false);
                  setShowOccupiedDropdown(false);
                }}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
              >
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
                <span className="font-medium">{selectedDate}</span>
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
              </button>

              {showDateDropdown && (
                <div className="absolute top-full mt-1 bg-white border rounded-lg shadow-lg w-72 p-4 z-30">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Select Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        dispatch(setReturnDate(e.target.value));
                        setShowDateDropdown(false);
                        clearSelections();
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="pt-3 border-t">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          dispatch(
                            setReturnDate(
                              new Date().toISOString().split("T")[0]
                            )
                          );
                          setShowDateDropdown(false);
                          clearSelections();
                        }}
                        className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                          selectedDate ===
                          new Date().toISOString().split("T")[0]
                            ? "bg-blue-600 text-white"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          dispatch(
                            setReturnDate(tomorrow.toISOString().split("T")[0])
                          );
                          setShowDateDropdown(false);
                          clearSelections();
                        }}
                        className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                          selectedDate ===
                          (() => {
                            const t = new Date();
                            t.setDate(t.getDate() + 1);
                            return t.toISOString().split("T")[0];
                          })()
                            ? "bg-blue-600 text-white"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        Tomorrow
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shift Selector */}
            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  setShowShiftDropdown(!showShiftDropdown);
                  setShowDateDropdown(false);
                  setShowDriverDropdown(false);
                  setShowPassengerDropdown(false);
                  setShowOccupiedDropdown(false);
                }}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
              >
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
                <span className="font-medium">{selectedShift}</span>
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
              </button>

              {showShiftDropdown && (
                <div className="absolute top-full mt-1 bg-white border rounded-lg shadow-lg w-48 py-1 z-30">
                  {shifts.map((shift) => (
                    <button
                      key={shift}
                      onClick={() => {
                        dispatch(setReturnShift(shift));
                        setShowShiftDropdown(false);
                        clearSelections();
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                        selectedShift === shift
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : ""
                      }`}
                    >
                      {shift}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col text-[10px] sm:text-xs text-gray-500">
            {lastFetchedLabel && (
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-400">
                Updated {lastFetchedLabel}
              </span>
            )}
            <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap">
              <div className="flex items-center gap-1">
                <Car className="w-3 h-3 text-blue-600" />
                <div className="flex flex-col text-sm leading-tight">
                  <span className="font-semibold text-gray-600">
                    {displayDriverCount}
                  </span>
                  <span className="text-[9px] text-gray-400">
                    {displayDriverCount} free / {totalDriverCount} total
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-green-600" />
                <span className="font-semibold text-gray-600">
                  {displayPassengerCount}
                </span>
              </div>
            </div>
          </div>

          {/* Driver Selector */}
          <div className="relative  min-w-0 max-w-[100px] sm:max-w-[140px] dropdown-container">
            <button
              onClick={() => {
                setShowDriverDropdown(!showDriverDropdown);
                setShowDateDropdown(false);
                setShowShiftDropdown(false);
                setShowPassengerDropdown(false);
                setShowOccupiedDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
            >
              <Car className="w-4 h-4 text-blue-600 flex-shrink-0" />

              <span className="flex-1 text-left truncate hidden lg:block">
                Drivers
              </span>
              {/* <span className="sm:hidden font-medium text-blue-600">
                {checkedDrivers.length > 0 ? checkedDrivers.length : ""}
              </span> */}
              <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
            </button>

            {showDriverDropdown && (
              <div className="absolute top-full mt-1 bg-white border rounded-lg shadow-lg w-96 z-30">
                <div className="p-2 border-b">
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search drivers..."
                      value={driverSearch}
                      onChange={(e) => setDriverSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* Driver Time Multi-Select Filter */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() =>
                        setShowDriverTimeDropdown(!showDriverTimeDropdown)
                      }
                      className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between bg-white hover:bg-gray-50"
                    >
                      <span className="truncate">
                        {driverTimeFilter.length === 0
                          ? "All Times"
                          : `${driverTimeFilter.length} time${
                              driverTimeFilter.length > 1 ? "s" : ""
                            } selected`}
                      </span>
                      <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" />
                    </button>

                    {showDriverTimeDropdown && (
                      <div className="absolute top-full mt-1 bg-white border rounded-lg shadow-lg w-full z-40 max-h-64 overflow-y-auto">
                        <div className="p-2 border-b flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">
                            Select Times
                          </span>
                          {driverTimeFilter.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDriverTimeFilter([]);
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        {driverTimes.map((time) => (
                          <label
                            key={time}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={driverTimeFilter.includes(time)}
                              onChange={(e) => {
                                e.stopPropagation();
                                const next = driverTimeFilter.includes(time)
                                  ? driverTimeFilter.filter((t) => t !== time)
                                  : [...driverTimeFilter, time];
                                setDriverTimeFilter(next);
                              }}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs flex-1">{time}</span>
                            <span className="text-xs text-gray-400">
                              {
                                rawDriverData.filter(
                                  (d) => normalizeTime(d.TIME || "") === time
                                ).length
                              }
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Active Filter Count */}
                  {driverTimeFilter.length > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {filteredDrivers.length} of {availableDrivers.length}{" "}
                        drivers
                      </p>
                      <button
                        onClick={() => {
                          setDriverTimeFilter([]);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}

                  {/* Select All / Clear All for map visibility */}
                  {filteredDrivers.length > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {checkedDrivers.length} of {filteredDrivers.length} on
                        map
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCheckedDrivers(filteredDrivers.map((d) => d.id));
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Select all
                        </button>
                        {checkedDrivers.length > 0 && (
                          <button
                            onClick={() => {
                              setCheckedDrivers([]);
                            }}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {driversLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      Loading drivers...
                    </div>
                  ) : driversError ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      {driversError}
                    </div>
                  ) : filteredDrivers.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      No drivers found
                    </div>
                  ) : (
                    filteredDrivers.map((driver) => (
                      <div
                        key={driver.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 ${
                          checkedDrivers.includes(driver.id) ? "bg-blue-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checkedDrivers.includes(driver.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleDriverVisibility(driver.id);
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            checkedDrivers.includes(driver.id)
                              ? "bg-blue-500"
                              : "bg-gray-200"
                          }`}
                        >
                          <Car
                            className={`w-5 h-5 ${
                              checkedDrivers.includes(driver.id)
                                ? "text-white"
                                : "text-gray-600"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {driver.name}{" "}
                            <span className="text-xs text-gray-400">
                              ({driver.id})
                            </span>
                            {driver.time && (
                              <span className="text-xs text-gray-500">
                                {" "}
                                - {driver.time}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            <span>{driver.subPoint}</span>
                            <span>•</span>
                            <Phone className="w-3 h-3" />
                            <span>{driver.phone}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Passenger Selector */}
          <div className="relative  min-w-0 max-w-[100px] sm:max-w-[140px] dropdown-container">
            <button
              onClick={() => {
                setShowPassengerDropdown(!showPassengerDropdown);
                setShowDateDropdown(false);
                setShowShiftDropdown(false);
                setShowDriverDropdown(false);
                setShowOccupiedDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors w-full text-xs sm:text-sm"
            >
              <Users className="w-4 h-4 text-green-600 flex-shrink-0" />

              <span className="flex-1 text-left truncate hidden lg:block">
                Passengers
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
            </button>

            {showPassengerDropdown && (
              <div className="absolute top-full mt-1 bg-white border rounded-lg shadow-lg w-[480px] z-30">
                <div className="p-2 border-b">
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search passengers..."
                      value={passengerSearch}
                      onChange={(e) => setPassengerSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  {/* Filters Row */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Work City Filter */}
                    <select
                      value={pickupCityFilter}
                      onChange={(e) => setPickupCityFilter(e.target.value)}
                      className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {pickupCities.map((city) => (
                        <option key={city} value={city}>
                          {city === "All" ? "All Work" : city}
                        </option>
                      ))}
                    </select>

                    {/* Home Destination Filter */}
                    <select
                      value={destinationCityFilter}
                      onChange={(e) => setDestinationCityFilter(e.target.value)}
                      className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {destinationCities.map((city) => (
                        <option key={city} value={city}>
                          {city === "All" ? "All Home" : city}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Time Multi-Select Filter */}
                  <div className="mt-2 relative dropdown-container">
                    <button
                      onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                      className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-between bg-white hover:bg-gray-50"
                    >
                      <span className="truncate">
                        {timeFilter.length === 0
                          ? "All Times"
                          : `${timeFilter.length} time${
                              timeFilter.length > 1 ? "s" : ""
                            } selected`}
                      </span>
                      <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" />
                    </button>

                    {showTimeDropdown && (
                      <div className="absolute top-full mt-1 bg-white border rounded-lg shadow-lg w-full z-40 max-h-64 overflow-y-auto">
                        <div className="p-2 border-b flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">
                            Select Times
                          </span>
                          {timeFilter.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTimeFilter([]);
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        {times
                          .filter((t) => t !== "All")
                          .map((time) => (
                            <label
                              key={time}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={timeFilter.includes(time)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (timeFilter.includes(time)) {
                                    setTimeFilter(
                                      timeFilter.filter((t) => t !== time)
                                    );
                                  } else {
                                    setTimeFilter([...timeFilter, time]);
                                  }
                                }}
                                className="w-3.5 h-3.5 text-green-600 rounded focus:ring-green-500"
                              />
                              <span className="text-xs flex-1">
                                {time.slice(0, 5)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {
                                  availablePassengers.filter(
                                    (p) => p.time === time
                                  ).length
                                }
                              </span>
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                  {/* Active Filter Count */}
                  {(pickupCityFilter !== "All" ||
                    destinationCityFilter !== "All" ||
                    timeFilter.length > 0) && (
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {filteredPassengers.length} of{" "}
                        {availablePassengers.length} passengers
                      </p>
                      <button
                        onClick={() => {
                          setPickupCityFilter("All");
                          setDestinationCityFilter("All");
                          setTimeFilter([]);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {passengersLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      Loading passengers...
                    </div>
                  ) : passengersError ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      {passengersError}
                    </div>
                  ) : filteredPassengers.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      No passengers found
                    </div>
                  ) : (
                    filteredPassengers.map((passenger) => (
                      <label
                        key={passenger.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPassengers
                            .map((s) => String(s))
                            .includes(String(passenger.id))}
                          onChange={() => togglePassenger(passenger.id)}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center`}
                          style={{
                            backgroundColor: passenger.color || "#10b981",
                          }}
                        >
                          <Users className={`w-5 h-5 text-white`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {passenger.name}{" "}
                            <span className="text-xs text-gray-400">
                              ({passenger.id})
                            </span>
                            {passenger.time && (
                              <span className="text-xs text-gray-500">
                                {" "}
                                - {passenger.time}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Building2 className="w-3 h-3" />
                            <span>{passenger.subPoint}</span>
                            <span>→</span>
                            <Home className="w-3 h-3" />
                            <span>{passenger.destinationSubPoint}</span>
                          </div>
                          {passenger.address && (
                            <p className="text-xs text-gray-500">
                              Pickup: {passenger.address}
                            </p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Occupied Selector */}
          <div className="relative  min-w-0 max-w-[100px] sm:max-w-[140px] dropdown-container">
            <button
              onClick={() => {
                setShowOccupiedDropdown(!showOccupiedDropdown);
                setShowDateDropdown(false);
                setShowShiftDropdown(false);
                setShowDriverDropdown(false);
                setShowPassengerDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
            >
              <Car className="w-4 h-4 text-red-600 flex-shrink-0" />

              <span className="flex-1 text-left truncate hidden lg:block">
                Occupied
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
            </button>

            {showOccupiedDropdown && (
              <div className="absolute top-full mt-1 bg-white border rounded-lg shadow-lg w-80 z-30">
                <div className="p-3 border-b text-sm text-gray-600">
                  Not available drivers ({occupiedDriverCount})
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {occupiedDrivers.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-500">
                      No occupied drivers currently.
                    </div>
                  ) : (
                    occupiedDrivers.map((driver) => (
                      <label
                        key={`${driver.id}-occupied`}
                        className="flex items-start gap-2 px-4 py-3 border-b last:border-b-0 text-xs leading-tight cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checkedDrivers.includes(driver.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleDriverVisibility(driver.id);
                          }}
                          className="mt-1 w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 truncate">
                            {driver.name}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {driver.id} • {driver.subPoint}
                          </p>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Route Info Display */}

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDummyPassengerModal(true);
                  setShowDriverDropdown(false);
                  setShowPassengerDropdown(false);
                  setShowDateDropdown(false);
                  setShowShiftDropdown(false);
                }}
                className="h-8 sm:h-9 px-2 sm:px-3 whitespace-nowrap"
                title="Add Dummy Passenger"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline ml-1 text-[11px]">
                  Dummy passenger
                </span>
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveReturnDummyPassengers}
              className="h-8 sm:h-9 px-2 sm:px-3 text-red-600 hover:text-red-800 border border-transparent hover:border-current"
            >
              <Trash className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline ml-1 text-[11px]">
                Clear dummies
              </span>
            </Button>
            {/* Fetch Data Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRouteParticipants}
              disabled={driversLoading || passengersLoading}
              className="h-8 sm:h-9 px-2 sm:px-3"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  driversLoading || passengersLoading ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline ml-1">
                {driversLoading || passengersLoading ? "Fetching..." : "Fetch"}
              </span>
            </Button>

            {/* Save Data Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                dispatch(
                  saveRouteData({
                    routeType: "return",
                    shift: normalizedShift,
                    date: selectedDate,
                    drivers: driversData,
                    passengers: passengersData,
                  })
                );
                setSaveDialogMessage(
                  `Data saved for ${selectedShift} shift (Return route)`
                );
                setShowSaveDialog(true);
              }}
              disabled={driversData.length === 0 && passengersData.length === 0}
              className="h-8 sm:h-9 px-2 sm:px-3"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Save</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDataClick}
              className="h-8 sm:h-9 px-2 sm:px-3 text-red-600"
            >
              <Trash className="w-4 h-4" />
              Delete
            </Button>

            {/* Map Navigation Controls */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={handleZoomIn}
                className="px-2 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-gray-100 transition-colors border-r"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={handleZoomOut}
                className="px-2 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-gray-100 transition-colors border-r"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={handleResetView}
                className="px-2 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-gray-100 transition-colors"
                title="Reset View"
              >
                <Maximize2 className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Map Area - Full Screen */}
      <div
        className="flex-1 relative bg-gray-900"
        style={{ minHeight: "400px" }}
      >
        <div
          ref={mapContainer}
          className="absolute inset-0 w-full h-full z-0"
          style={{ minHeight: "400px" }}
        />

        {(driversLoading || passengersLoading) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur">
            <Loader2 className="w-8 h-8 mb-2 animate-spin text-blue-600" />
            <p className="text-sm font-semibold text-blue-700">
              Fetching drivers & passengers
            </p>
          </div>
        )}

        {!selectedDriver && selectedPassengers.length === 0 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-lg shadow-lg z-10 border">
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Select a driver and passengers to calculate return route
            </p>
          </div>
        )}

        {isCalculating && (
          <div className="absolute top-6 right-6 bg-white px-4 py-3 rounded-lg shadow-lg z-10 border flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600">Calculating route...</p>
          </div>
        )}

        {/* Bottom Panel - Collapsible */}
        {showBottomPanel && routeInfo && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-white border-t shadow-lg">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Driver</p>
                      <p className="font-medium text-sm">
                        {currentDriver?.name}
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-10 bg-gray-200"></div>

                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500">Passengers</p>
                      <p className="font-medium text-sm">
                        {selectedPassengers.length} selected
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-10 bg-gray-200"></div>

                  <div className="flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Distance</p>
                      <p className="font-bold text-sm text-blue-600">
                        {routeInfo.distance.toFixed(1)} km
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-10 bg-gray-200"></div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500">Time</p>
                      <p className="font-bold text-sm text-green-600">
                        {Math.round(routeInfo.duration)} min
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-10 bg-gray-200"></div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={changeRouteColor}
                    className="h-9"
                  >
                    <div
                      className="w-4 h-4 rounded-full mr-2"
                      style={{
                        backgroundColor: routeColors[routeColorIndex].primary,
                      }}
                    ></div>
                    {routeColors[routeColorIndex].name} Route
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelections}
                    className="h-9"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={queueRoute}
                    disabled={!canQueueRoute}
                    className="h-9"
                  >
                    <List className="w-4 h-4 mr-2" />
                    Queue Route
                  </Button>
                  <Button onClick={saveRoute} className="h-9">
                    <Save className="w-4 h-4 mr-2" />
                    Save Route
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {pendingRoutes.length > 0 && (
          <div className="absolute bottom-32 right-4 z-40 w-80 max-h-[320px]">
            <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-gray-600" />
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      Queued {routeTypeLabel} routes
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {pendingRoutes.length} route
                      {pendingRoutes.length > 1 ? "s" : ""} ready to save
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingRoutes([])}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: route.color.primary }}
                    />
                    <div className="flex flex-1 flex-col gap-0.5 text-xs">
                      <div className="text-xs font-semibold text-gray-900 truncate">
                        {route.name}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>
                          {route.driverSnapshot?.name || "Driver"} •{" "}
                          {route.passengerIds.length} passengers
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              applyQueuedRouteForEditing(route);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                            aria-label="Edit queued route"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removePendingRoute(route.id);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                            aria-label="Remove queued route"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={flushPendingRoutes} className="w-full">
                Save all ({pendingRoutes.length})
              </Button>
            </div>
          </div>
        )}
      </div>
      {showDummyPassengerModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowDummyPassengerModal(false)}
            ></div>
            <div className="relative w-full max-w-lg rounded-2xl border bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">
                  Add Dummy Passenger
                </h3>
                <button
                  onClick={() => setShowDummyPassengerModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {dummyPassengerRows.map((row, rowIndex) => (
                  <div
                    key={row.id}
                    className="border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-700">
                        Home Location Coordinates {rowIndex + 1}
                      </p>
                      {dummyPassengerRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDummyPassengerRow(row.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Latitude
                        </label>
                        <input
                          type="text"
                          placeholder="12.9716"
                          value={row.homeLat}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDummyPassengerRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, homeLat: value }
                                  : item
                              )
                            );
                          }}
                          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Longitude
                        </label>
                        <input
                          type="text"
                          placeholder="77.5946"
                          value={row.homeLog}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDummyPassengerRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, homeLog: value }
                                  : item
                              )
                            );
                          }}
                          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                      Lat/Long here override the pickup coordinate pair.
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDummyPassengerModal(false)}
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddDummyPassengers}
                  className="h-9"
                  disabled={dummyPassengerRows.some(
                    (row) => !row.homeLat.trim() || !row.homeLog.trim()
                  )}
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add Passenger
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
      <InfoDialog
        open={showSaveDialog}
        title="Data saved"
        description={saveDialogMessage}
        confirmLabel="OK"
        onConfirm={() => setShowSaveDialog(false)}
      />

      <ConfirmationDialog
        open={showClearDialog}
        title="Clear cached route data?"
        description="This will remove every cached driver and passenger entry stored in browser. You can fetch fresh data afterwards."
        confirmLabel="Clear data"
        cancelLabel="Cancel"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />
    </div>
  );
}

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      ></div>
      <div className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-9"
          >
            {cancelLabel}
          </Button>
          <Button size="sm" onClick={onConfirm} className="h-9">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface InfoDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

function InfoDialog({
  open,
  title,
  description,
  confirmLabel = "OK",
  onConfirm,
}: InfoDialogProps) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <Button size="sm" onClick={onConfirm} className="h-9">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
