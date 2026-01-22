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
} from "lucide-react";
import { driversService, passengersService } from "../../api/services";
import { RouteParticipant, SavedRoute, RouteInfo } from "../../types/route";
import { ShiftDriver, ShiftPassenger } from "../../types/transport";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setReturnDate, setReturnShift, setReturnDriver, setReturnPassengers } from "../../store/slices/filterSlice";
import { saveRouteData, clearAllData } from "../../store/slices/dataSlice";
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
  savedRoutes: SavedRoute[];
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

export function ReturnRoute({ savedRoutes, onSaveRoute }: ReturnRouteProps) {
  const dispatch = useAppDispatch();
  const { selectedDate, selectedShift, selectedDriver, selectedPassengers } = useAppSelector(
    (state) => state.filters.return
  );

  const setSelectedDriver = (driver: string | null) => {
    dispatch(setReturnDriver(driver));
  };

  const setSelectedPassengers = (passengers: string[]) => {
    dispatch(setReturnPassengers(passengers));
  };

  const returnRoutes = savedRoutes.filter(
    (route) => route.routeType === "return"
  );

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeColorIndex, setRouteColorIndex] = useState(0);
  const [driversData, setDriversData] = useState<ShiftDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [passengersData, setPassengersData] = useState<ShiftPassenger[]>([]);
  const [passengersLoading, setPassengersLoading] = useState(false);
  const [passengersError, setPassengersError] = useState<string | null>(null);

  // Dropdown states
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [showPassengerDropdown, setShowPassengerDropdown] = useState(false);
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");
  const [passengerSearch, setPassengerSearch] = useState("");

  // Filter states
  const [pickupCityFilter, setPickupCityFilter] = useState<string>("All");
  const [destinationCityFilter, setDestinationCityFilter] =
    useState<string>("All");
  const [timeFilter, setTimeFilter] = useState<string[]>([]); // Passenger time filter
  const [driverTimeFilter, setDriverTimeFilter] = useState<string[]>([]); // Driver time filter
  const [checkedDrivers, setCheckedDrivers] = useState<string[]>([]); // Drivers visible on map

  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showDriverTimeDropdown, setShowDriverTimeDropdown] = useState(false);

  // Bottom panel state
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const shifts = SHIFT_TYPES;

  const routeColors = [
    { primary: "#3b82f6", name: "Blue" },
    { primary: "#8b5cf6", name: "Purple" },
    { primary: "#ec4899", name: "Pink" },
    { primary: "#f59e0b", name: "Orange" },
    { primary: "#10b981", name: "Green" },
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

  const displayDriverCount = savedRouteData?.drivers.length ?? drivers.length;
  const displayPassengerCount =
    savedRouteData?.passengers.length ?? passengers.length;

  // Filter out drivers and passengers that are already used in saved RETURN routes only
  // const usedDriverIds = new Set(
  //   savedRoutes
  //     .filter((route) => route.routeType === "return")
  //     .map((route) => route.driverId)
  // );
  const usedPassengerIds = new Set(
    savedRoutes
      .filter((route) => route.routeType === "return")
      .flatMap((route) => route.passengerIds)
  );

  const availableDrivers = drivers;
  const availablePassengers = passengers.filter(
    (passenger) => !usedPassengerIds.has(passenger.id)
  );

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
    const matchesSearch =
      d.name.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.subPoint.toLowerCase().includes(driverSearch.toLowerCase());

    // Find original driver data to check time
    const originalDriver = rawDriverData.find(
      (rd) =>
        extractCleanName(rd.DRIVER_NAME).toLowerCase() ===
          d.name.toLowerCase() &&
        (rd.DRIVER_SUBPOINT || rd.HOME_LOCATION || "").toLowerCase() ===
          d.subPoint.toLowerCase()
    );
    const originalTime = normalizeTime(originalDriver?.TIME || "");

    // If no time filter selected, show all drivers
    if (driverTimeFilter.length === 0) {
      return matchesSearch;
    }

    // If time filter selected, require matching time (normalized)
    const normalizedFilter = driverTimeFilter.map((t) => normalizeTime(t));
    const matchesTime =
      originalTime !== "" && normalizedFilter.includes(originalTime);

    return matchesSearch && matchesTime;
  });

  // Apply all filters to passengers
  const filteredPassengers = availablePassengers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(passengerSearch.toLowerCase()) ||
      p.subPoint.toLowerCase().includes(passengerSearch.toLowerCase());

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

  // Get selected driver and passengers
  const currentDriver = availableDrivers.find((d) => d.id === selectedDriver);
  const currentPassengers = availablePassengers.filter((p) =>
    selectedPassengers.includes(p.id)
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
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  ]);

  const updateMarkersAndRoute = () => {
    if (!map.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add driver markers based on filter and checkbox selection
    const driversToShow =
      checkedDrivers.length > 0
        ? filteredDrivers.filter((d) => checkedDrivers.includes(d.id))
        : filteredDrivers;

    driversToShow.forEach((driver) => {
      const isSelected = driver.id === selectedDriver;
      const displayName = driver.name.split(" ")[0];
      const el = document.createElement("div");
      el.style.width = isSelected ? "40px" : "32px";
      el.style.height = isSelected ? "40px" : "32px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = isSelected ? "#3b82f6" : "#93c5fd";
      el.style.border = isSelected ? "3px solid white" : "2px solid white";
      el.style.boxShadow = isSelected
        ? "0 4px 8px rgba(0,0,0,0.3)"
        : "0 2px 4px rgba(0,0,0,0.2)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.cursor = "pointer";
      el.style.transition = "all 0.2s";
      el.innerHTML = `
          <div style="
            background-color: #f20505;
            color: white;
            font-size: 9px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            margin-top: 2px;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            max-width: 70px;
            max-width="${isSelected ? "70px" : "60px"}"
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
                <strong class="block">${driver.name}</strong>
                <span class="text-xs ${
                  isSelected ? "text-blue-600 font-bold" : "text-blue-600"
                }">${isSelected ? "SELECTED DRIVER" : "DRIVER"}</span>
              </div>
            </div>
            <p class="text-xs text-gray-600 mb-1"><strong>Driver id:</strong> ${
              driver.id
            }</p>
            <p class="text-xs text-gray-600 mb-1"><strong>Time:</strong> ${
              driver.time
            }</p>
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
    });

    // Add filtered passenger markers with unique colors (work and home locations)
    filteredPassengers.forEach((passenger) => {
      const isSelected = selectedPassengers.includes(passenger.id);
      const color = passenger.color || "#10b981";

      // Format time for display (show only HH:MM)
      const displayTime = passenger.time ? passenger.time.slice(0, 5) : "";

      // Add work location marker (Building icon) with time label
      const workEl = document.createElement("div");
      workEl.style.display = "flex";
      workEl.style.flexDirection = "column";
      workEl.style.alignItems = "center";
      workEl.style.cursor = "pointer";
      workEl.style.transition = "all 0.2s";
      workEl.innerHTML = `
        <div style="
          width: ${isSelected ? "32px" : "24px"};
          height: ${isSelected ? "32px" : "24px"};
          border-radius: 50%;
          background-color: ${isSelected ? "#3b82f5" : "#629dfc"};
          border: ${isSelected ? "3px solid white" : "2px solid white"};
          box-shadow: ${
            isSelected
              ? "0 4px 8px rgba(0,0,0,0.3)"
              : "0 2px 4px rgba(0,0,0,0.2)"
          };
          display: flex;
          align-items: center;
          justify-content: center;
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
          background-color: #036ffc;
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

      // Click handler to toggle passenger selection
      workEl.addEventListener("click", () => {
        workPopup.remove(); // hover-only popup
        togglePassenger(passenger.id);
      });

      const workPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: "320px",
      }).setHTML(`
          <div style="padding: 12px; font-family: Arial, sans-serif; line-height: 1.4; color: #1f2937;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" class="bg-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
              </div>
              <div style="min-width: 0; flex: 1;">
                <strong style="display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${
                  passenger.name
                }</strong>
                <span class="text-xs ${
                  isSelected ? "text-green-600 font-bold" : "text-green-600"
                }">${isSelected ? "SELECTED - WORK" : "WORK LOCATION"}</span>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
              <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; display: flex; gap: 8px; align-items: flex-start;">
                <span style="flex-shrink: 0;">??</span>
                <div style="min-width: 0; flex: 1;">
                  <p style="margin: 0; font-weight: 600; color: #374151;">Phone</p>
                  <p style="margin: 2px 0 0 0; color: #374151;">${
                    passenger.phone
                  }</p>
                </div>
              </div>
              <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; display: flex; gap: 8px; align-items: flex-start;">
                <span style="flex-shrink: 0;">??</span>
                <div style="min-width: 0; flex: 1; overflow: hidden;">
                  <p style="margin: 0; font-weight: 600; color: #374151;">Pickup Location (Work)</p>
                  <p style="margin: 2px 0 0 0; color: #374151; font-weight: 500;">${
                    passenger.subPoint || "N/A"
                  }</p>
                  <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 11px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${
                    passenger.address || ""
                  }</p>
                </div>
              </div>
              <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; display: flex; gap: 8px; align-items: flex-start;">
                <span style="flex-shrink: 0;">??</span>
                <div style="min-width: 0; flex: 1; overflow: hidden;">
                  <p style="margin: 0; font-weight: 600; color: #374151;">Drop-off Location (Home)</p>
                  <p style="margin: 2px 0 0 0; color: #374151; font-weight: 500;">${
                    passenger.destinationSubPoint || "N/A"
                  }</p>
                  <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 11px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${
                    passenger.destination || ""
                  }</p>
                </div>
              </div>
            </div>
            ${
              !isSelected
                ? '<p class="text-green-500" style="font-size: 11px; font-weight: 500; cursor: pointer; margin-top: 10px; text-align: center;">Click marker to select</p>'
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

      // Add home destination marker (Home icon) with time label - ALWAYS SHOW
      if (passenger.destinationCoordinates) {
        const homeEl = document.createElement("div");
        homeEl.style.display = "flex";
        homeEl.style.flexDirection = "column";
        homeEl.style.alignItems = "center";
        homeEl.style.cursor = "pointer";
        homeEl.style.transition = "all 0.2s";

        homeEl.innerHTML = `
          <div style="
            width: ${isSelected ? "28px" : "22px"};
            height: ${isSelected ? "28px" : "22px"};
            border-radius: 50%;
            background-color: ${isSelected ? "#10b981" : "#86efac"};
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
            background-color: #036ffc;
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

        homeEl.addEventListener("click", () => {
          homePopup.remove(); // hover-only popup
          togglePassenger(passenger.id);
        });

        const homePopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: "320px",
        }).setHTML(`
            <div style="padding: 12px; font-family: Arial, sans-serif; line-height: 1.4; color: #1f2937;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" class="bg-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                </div>
                <div style="min-width: 0; flex: 1;">
                  <strong style="display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${
                    passenger.name
                  } - <span>${passenger.id}</span></strong>
                  <span style="font-size: 11px; font-weight: bold;"class="text-xs ${
                    isSelected ? "text-green-600 font-bold" : "text-green-600"
                  }">${
          isSelected ? "SELECTED - HOME" : "HOME DESTINATION"
        }</span>, <span>${passenger.time}</span>
                </div>
              </div>
            
             
              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; display: flex; gap: 8px; align-items: flex-start;">
                  <span style="flex-shrink: 0;">??</span>
                  <div style="min-width: 0; flex: 1;">
                    <p style="margin: 0; font-weight: 600; color: #374151;">Phone</p>
                    <p style="margin: 2px 0 0 0; color: #374151;">${
                      passenger.phone
                    }</p>
                  </div>
                </div>
                <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; display: flex; gap: 8px; align-items: flex-start;">
                  <span style="flex-shrink: 0;">??</span>
                  <div style="min-width: 0; flex: 1; overflow: hidden;">
                    <p style="margin: 0; font-weight: 600; color: #374151;">Pickup Location (Work)</p>
                    <p style="margin: 2px 0 0 0; color: #374151; font-weight: 500;">${
                      passenger.subPoint || "N/A"
                    }</p>
                    <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 11px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${
                      passenger.address || ""
                    }</p>
                  </div>
                </div>
                <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; display: flex; gap: 8px; align-items: flex-start;">
                  <span style="flex-shrink: 0;">??</span>
                  <div style="min-width: 0; flex: 1; overflow: hidden;">
                    <p style="margin: 0; font-weight: 600; color: #374151;">Drop-off Location (Home)</p>
                    <p style="margin: 2px 0 0 0; color: #374151; font-weight: 500;">${
                      passenger.destinationSubPoint || "N/A"
                    }</p>
                    <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 11px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${
                      passenger.destination || ""
                    }</p>
                  </div>
                </div>
              </div>
              ${
                !isSelected
                  ? '<p class="text-xs text-green-500" style="font-size: 11px; font-weight: 500; cursor: pointer; margin-top: 10px; text-align: center;">Click marker to select</p>'
                  : ""
              }
            </div>
          `);

        // Hover handlers to show/hide popup
        homeEl.addEventListener("mouseenter", () => {
          homePopup
            .setLngLat(passenger.destinationCoordinates!)
            .addTo(map.current!);
        });

        homeEl.addEventListener("mouseleave", () => {
          homePopup.remove();
        });

        const homeMarker = new mapboxgl.Marker(homeEl)
          .setLngLat(passenger.destinationCoordinates)
          .addTo(map.current!);

        markersRef.current.push(homeMarker);
      }
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

  const togglePassenger = (passengerId: string) => {
    const newPassengers = selectedPassengers.includes(passengerId)
      ? selectedPassengers.filter((id) => id !== passengerId)
      : [...selectedPassengers, passengerId];
    setSelectedPassengers(newPassengers);
  };

  const clearSelections = () => {
    setSelectedDriver(null);
    setSelectedPassengers([]);
    setRouteInfo(null);
    setShowBottomPanel(false);
  };

  const clearRouteState = () => {
    clearSelections();
    setDriversData([]);
    setPassengersData([]);
    setCheckedDrivers([]);
    setDriversError(null);
    setPassengersError(null);
    setDriverSearch("");
    setPassengerSearch("");
    setPickupCityFilter("All");
    setDestinationCityFilter("All");
    setTimeFilter([]);
    setDriverTimeFilter([]);
    setShowDriverDropdown(false);
    setShowPassengerDropdown(false);
    setShowTimeDropdown(false);
    setShowDriverTimeDropdown(false);
    setShowDateDropdown(false);
    setShowShiftDropdown(false);
    dispatch(clearAllData());
  };

  const handleClearDataClick = () => {
    setShowClearDialog(true);
  };

  const handleConfirmClear = () => {
    clearRouteState();
    setShowClearDialog(false);
  };

  const handleCancelClear = () => {
    setShowClearDialog(false);
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

  const saveRoute = () => {
    if (!selectedDriver || selectedPassengers.length === 0 || !routeInfo)
      return;

    const driverSnapshot = currentDriver
      ? toParticipantSnapshot(currentDriver)
      : undefined;
    const passengerSnapshots = currentPassengers.map(toParticipantSnapshot);

    const newRoute: SavedRoute = {
      id: `route-${Date.now()}`,
      name: `Return Route ${returnRoutes.length + 1}`,
      driverId: selectedDriver,
      passengerIds: selectedPassengers,
      routeInfo: routeInfo,
      color: routeColors[routeColorIndex],
      visible: true,
      createdAt: new Date().toISOString(),
      routeType: "return",
      driverSnapshot,
      passengerSnapshots,
      date: selectedDate,
      shift: selectedShift,
    };

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
                <span className="font-semibold text-gray-600">
                  {displayDriverCount}
                </span>
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
          <div className="relative flex-1 min-w-0 max-w-[100px] sm:max-w-[140px] dropdown-container">
            <button
              onClick={() => {
                setShowDriverDropdown(!showDriverDropdown);
                setShowDateDropdown(false);
                setShowShiftDropdown(false);
                setShowPassengerDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
            >
              <Car className="w-4 h-4 text-blue-600 flex-shrink-0" />

              <span className="flex-1 text-left truncate hidden lg:block">
                {checkedDrivers.length > 0
                  ? `${checkedDrivers.length} Driver${
                      checkedDrivers.length > 1 ? "s" : ""
                    }`
                  : "Drivers"}
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
                                setDriverTimeFilter((prev) =>
                                  prev.includes(time)
                                    ? prev.filter((t) => t !== time)
                                    : [...prev, time]
                                );
                                setShowDriverTimeDropdown(false);
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
                          setShowDriverTimeDropdown(false);
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
                            setCheckedDrivers((prev) =>
                              prev.includes(driver.id)
                                ? prev.filter((id) => id !== driver.id)
                                : [...prev, driver.id]
                            );
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
                            {driver.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            <span>{driver.subPoint}</span>
                            <span>�</span>
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
          <div className="relative flex-1 min-w-0 max-w-[100px] sm:max-w-[140px] dropdown-container">
            <button
              onClick={() => {
                setShowPassengerDropdown(!showPassengerDropdown);
                setShowDateDropdown(false);
                setShowShiftDropdown(false);
                setShowDriverDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors w-full text-xs sm:text-sm"
            >
              <Users className="w-4 h-4 text-green-600 flex-shrink-0" />

              <span className="flex-1 text-left truncate hidden lg:block">
                {selectedPassengers.length > 0
                  ? `${selectedPassengers.length} Passenger`
                  : "Passengers"}
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
                                setShowTimeDropdown(false);
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
                                  setShowTimeDropdown(false);
                                }}
                                className="w-3.5 h-3.5 text-green-600 rounded focus:ring-green-500"
                              />
                              <span className="text-xs flex-1">
                                {time.slice(0, 5)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {
                                  rawPassengerData.filter(
                                    (p) => p.TIME === time
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
                        {filteredPassengers.length} of {passengers.length}{" "}
                        passengers
                      </p>
                      <button
                        onClick={() => {
                          setPickupCityFilter("All");
                          setDestinationCityFilter("All");
                          setTimeFilter([]);
                          setShowTimeDropdown(false);
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
                          checked={selectedPassengers.includes(passenger.id)}
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
                            {passenger.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Building2 className="w-3 h-3" />
                            <span>{passenger.subPoint}</span>
                            <span>?</span>
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

          {/* Route Info Display */}

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
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
                {driversLoading || passengersLoading
                  ? "Fetching..."
                  : "Fetch Data"}
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
                alert(`Data saved for ${selectedShift} shift (Return route)`);
              }}
              disabled={driversData.length === 0 && passengersData.length === 0}
              className="h-8 sm:h-9 px-2 sm:px-3"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Save Data</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDataClick}
              className="h-8 sm:h-9 px-2 sm:px-3 text-red-600 border-red-200 hover:border-red-300"
            >
              Clear Data
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
      </div>

      {/* Bottom Panel - Collapsible */}
      {showBottomPanel && routeInfo && (
        <div className="bg-white border-t shadow-lg">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">Driver</p>
                    <p className="font-medium text-sm">{currentDriver?.name}</p>
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
                <Button onClick={saveRoute} className="h-9">
                  <Save className="w-4 h-4 mr-2" />
                  Save Route
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmationDialog
        open={showClearDialog}
        title="Clear cached route data?"
        description="This will remove every cached driver and passenger entry stored in Redux. You can fetch fresh data afterwards."
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
