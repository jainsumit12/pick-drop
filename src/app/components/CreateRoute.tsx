import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import { Button } from "./ui/button";
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
  Calendar,
  RefreshCw,
  Download,
  Loader2,
  Trash,
} from "lucide-react";
import { driversService, passengersService } from "../../api/services";
import { RouteParticipant, SavedRoute, RouteInfo } from "../../types/route";
import { ShiftDriver, ShiftPassenger } from "../../types/transport";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setGoingDate,
  setGoingShift,
  setGoingDriver,
  setGoingPassengers,
  setGoingPickupCityFilter,
  setGoingDestinationCityFilter,
  setGoingTimeFilter,
  setGoingDriverTimeFilter,
  setGoingDriverSearch,
  setGoingPassengerSearch,
} from "../../store/slices/filterSlice";
import { clearAllData, saveRouteData } from "../../store/slices/dataSlice";
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

interface CreateRouteProps {
  savedRoutes: SavedRoute[];
  onSaveRoute: (route: SavedRoute) => void;
}

const extractCleanName = (fullName: string): string => {
  const match = fullName.match(/^([^-]+)/);
  return match ? match[1].trim() : fullName;
};

const extractId = (fullName: string, location?: string): string => {
  const match = fullName.match(/- (\d+)/);
  if (match) return match[1];
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
  const trimmed = time.trim();
  // Extract just the time part (HH:MM) from formats like "7:00 AM" or "7:00:00"
  // Match pattern: digits:digits at the start of the string
  const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})/);
  if (timeMatch) {
    return timeMatch[1]; // Returns just "7:00" from "7:00 AM" or "7:00:00"
  }
  return trimmed;
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

// Convert rider data to Location format
const convertRidersToLocations = (
  riders: ShiftDriver[],
  shift: string,
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

// Convert passenger data to Location format
const convertPassengersToLocations = (
  passengers: ShiftPassenger[],
  shift: string,
): Location[] => {
  return passengers.flatMap((passenger, index) => {
    const pickupLat = parseCoordinate(passenger.PICKUP_LAT);
    const pickupLog = parseCoordinate(passenger.PICKUP_LOG);
    if (passenger.SHIFT !== shift || pickupLat === null || pickupLog === null) {
      return [];
    }

    const dropLat = parseCoordinate(passenger.DROP_LAT);
    const dropLog = parseCoordinate(passenger.DROP_LOG);

    return [
      {
        id: passenger.USER_ID,
        name: passenger.NAME,
        coordinates: [pickupLog, pickupLat],
        type: "passenger" as const,
        phone: passenger.MOBILE.toString(),
        address: passenger.PICKUP_LOCATION,
        subPoint: passenger.PICKUP_SUBPOINT,
        shiftTime: passenger.SHIFT,
        time: passenger.TIME,
        destinationCoordinates:
          dropLat !== null && dropLog !== null ? [dropLog, dropLat] : undefined,
        destination: passenger.DROP_LOCATION,
        destinationSubPoint: passenger.DROP_SUBPOINT,
      },
    ];
  });
};

export function CreateRoute({ savedRoutes, onSaveRoute }: CreateRouteProps) {
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
  } = useAppSelector((state) => state.filters.going);

  const setSelectedDriver = (driver: string | null) => {
    dispatch(setGoingDriver(driver));
  };

  const setSelectedPassengers = (passengers: string[]) => {
    dispatch(setGoingPassengers(passengers));
  };

  const setPickupCityFilter = (value: string) => {
    dispatch(setGoingPickupCityFilter(value));
  };

  const setDestinationCityFilter = (value: string) => {
    dispatch(setGoingDestinationCityFilter(value));
  };

  const setTimeFilter = (values: string[]) => {
    dispatch(setGoingTimeFilter(values));
  };

  const setDriverTimeFilter = (values: string[]) => {
    dispatch(setGoingDriverTimeFilter(values));
  };

  const setDriverSearch = (value: string) => {
    dispatch(setGoingDriverSearch(value));
  };

  const setPassengerSearch = (value: string) => {
    dispatch(setGoingPassengerSearch(value));
  };

  const goingRoutes = savedRoutes.filter(
    (route) => route.routeType === "going",
  );
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeColorIndex, setRouteColorIndex] = useState(0);
  const [distanceSaved, setDistanceSaved] = useState<number>(0); // Track distance saved by optimization
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

  // Filter states
  const [checkedDrivers, setCheckedDrivers] = useState<string[]>([]); // Drivers visible on map

  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showDriverTimeDropdown, setShowDriverTimeDropdown] = useState(false);

  // Bottom panel state
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogMessage, setSaveDialogMessage] = useState("");

  const shifts = SHIFT_TYPES;

  const routeColors = [
    { primary: "#3b82f6", name: "Blue" },
    { primary: "#8b5cf6", name: "Purple" },
    { primary: "#ec4899", name: "Pink" },
    { primary: "#f59e0b", name: "Orange" },
    { primary: "#10b981", name: "Green" },
  ];
  const routeType: "going" = "going";
  const routeTypeLabel = routeType.charAt(0).toUpperCase() + routeType.slice(1);
  const normalizedShift = normalizeShift(selectedShift);
  const savedRouteData = useAppSelector(
    (state) => state.data.byDate[selectedDate]?.going?.[normalizedShift],
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
    selectedShift,
  );

  const displayDriverCount =
    driversData.length > 0
      ? driversData.length
      : savedRouteData?.drivers.length ?? drivers.length;
  const displayPassengerCount =
    passengersData.length > 0
      ? passengersData.length
      : savedRouteData?.passengers.length ?? passengers.length;

  // Filter out drivers and passengers that are already used in saved GOING routes only
  // const usedDriverIds = new Set(
  //   savedRoutes
  //     .filter((route) => route.routeType === "going")
  //     .map((route) => route.driverId)
  // );
  const usedPassengerIds = new Set(
    savedRoutes
      .filter((route) => route.routeType === "going")
      .flatMap((route) => route.passengerIds),
  );

  const availableDrivers = drivers;
  const availablePassengers = passengers.filter(
    (passenger) => !usedPassengerIds.has(passenger.id),
  );

  // Extract unique filter options from passenger data
  const rawPassengerData = passengersData.filter(
    (p) => p.SHIFT === selectedShift,
  );
  const pickupCities = [
    "All",
    ...Array.from(new Set(rawPassengerData.map((p) => p.PICKUP_SUBPOINT))),
  ];
  const destinationCities = [
    "All",
    ...Array.from(new Set(rawPassengerData.map((p) => p.DROP_SUBPOINT))),
  ];
  const times = [
    "All",
    ...Array.from(new Set(rawPassengerData.map((p) => p.TIME))).sort(),
  ];

  // Extract unique driver times
  const rawDriverData = driversData.filter((r) => r.SHIFT === selectedShift);
  const driverTimes = Array.from(
    new Set(
      rawDriverData.map((r) => normalizeTime(r.TIME || "")).filter(Boolean),
    ),
  ).sort();

  // Filter drivers and passengers based on search
  const filteredDrivers = availableDrivers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.subPoint.toLowerCase().includes(driverSearch.toLowerCase());

    // Find original driver data to check time (same approach as passenger filter)
    const originalDriver = rawDriverData.find(
      (rd) =>
        extractCleanName(rd.DRIVER_NAME) === d.name &&
        rd.DRIVER_SUBPOINT === d.subPoint,
    );

    const originalTime = normalizeTime(originalDriver?.TIME || "");

    // If no time filter selected, show all drivers that match search
    if (driverTimeFilter.length === 0) {
      return matchesSearch;
    }

    // If time filter selected, require the driver's time to be in the filter (match passenger logic)
    const matchesTime =
      originalTime !== "" &&
      driverTimeFilter.map((t) => normalizeTime(t)).includes(originalTime);

    return matchesSearch && matchesTime;
  });
  const filteredPassengers = availablePassengers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(passengerSearch.toLowerCase()) ||
      p.subPoint.toLowerCase().includes(passengerSearch.toLowerCase()) ||
      (p.destinationSubPoint &&
        p.destinationSubPoint
          .toLowerCase()
          .includes(passengerSearch.toLowerCase())) ||
      p.address.toLowerCase().includes(passengerSearch.toLowerCase()) ||
      (p.destination &&
        p.destination.toLowerCase().includes(passengerSearch.toLowerCase()));

    const matchesPickupCity =
      pickupCityFilter === "All" || p.subPoint === pickupCityFilter;
    const matchesDestinationCity =
      destinationCityFilter === "All" ||
      p.destinationSubPoint === destinationCityFilter;

    // Find original passenger data to check time
    const originalPassenger = rawPassengerData.find(
      (pd) =>
        extractCleanName(pd.NAME) === p.name &&
        pd.PICKUP_SUBPOINT === p.subPoint,
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

  const currentDriver = availableDrivers.find((d) => d.id === selectedDriver);
  const currentPassengers = availablePassengers.filter((p) =>
    selectedPassengers.includes(p.id),
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
      el.innerHTML = `
          <div style="
            background-color: ${isSelected ? "#a10505" : "#f20505"};
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
                <strong class="block">${driver.name}, ${driver.id}</strong>
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
    });

    // Add ONLY FILTERED passenger markers
    filteredPassengers.forEach((passenger) => {
      const isSelected = selectedPassengers.includes(passenger.id);

      // Add pickup marker (green) with time label
      const el = document.createElement("div");
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.alignItems = "center";
      el.style.cursor = "pointer";
      el.style.transition = "all 0.2s";

      // Format time for display (show only HH:MM)
      const displayTime = passenger.time ? passenger.time.slice(0, 5) : "";

      el.innerHTML = `
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
          }" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
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
      el.addEventListener("click", () => {
        pickupPopup.remove(); // keep popup hover-only
        togglePassenger(passenger.id);
      });

      const pickupPopup = new mapboxgl.Popup({
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
                  passenger.time
                }</span>
              </div>
            </div>
        
            <p class="text-xs text-gray-600 mb-1"><strong>Location:</strong> ${
              passenger.subPoint
            }</p>
            <p class="text-xs text-gray-600 mb-1"><strong>Phone:</strong> ${
              passenger.phone
            }</p>
            <p class="text-xs text-gray-500 mb-2">${passenger.address}</p>
            <p class="text-xs text-gray-500 mb-2"><strong>Drop Location:</strong> ${
              passenger.destination
            }</p>
            ${
              passenger.destinationSubPoint
                ? `<p class="text-xs text-orange-600 font-medium"><strong>Destination:</strong> ${passenger.destinationSubPoint}</p>`
                : ""
            }
            ${
              !isSelected
                ? '<p class="text-xs text-green-600 font-medium cursor-pointer mt-1">Click marker to select</p>'
                : ""
            }
          </div>
        `);

      // Hover handlers to show/hide popup
      el.addEventListener("mouseenter", () => {
        pickupPopup.setLngLat(passenger.coordinates).addTo(map.current!);
      });

      el.addEventListener("mouseleave", () => {
        pickupPopup.remove();
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat(passenger.coordinates)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Group selected passengers by destination coordinates for drop-off markers
    const destinationGroups = new Map<string, Location[]>();
    filteredPassengers.forEach((passenger) => {
      const isSelected = selectedPassengers.includes(passenger.id);
      if (passenger.destinationCoordinates && isSelected) {
        const coordKey = `${passenger.destinationCoordinates[0]},${passenger.destinationCoordinates[1]}`;
        if (!destinationGroups.has(coordKey)) {
          destinationGroups.set(coordKey, []);
        }
        destinationGroups.get(coordKey)!.push(passenger);
      }
    });

    // Create destination markers for each unique location
    destinationGroups.forEach((passengersAtDest, coordKey) => {
      const [lng, lat] = coordKey.split(",").map(Number);
      const coordinates: [number, number] = [lng, lat];
      const passengerCount = passengersAtDest.length;

      const destEl = document.createElement("div");
      destEl.style.width = passengerCount > 1 ? "32px" : "28px";
      destEl.style.height = passengerCount > 1 ? "32px" : "28px";
      destEl.style.borderRadius = "50%";
      destEl.style.backgroundColor = "#f59e0b";
      destEl.style.border = "3px solid white";
      destEl.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
      destEl.style.display = "flex";
      destEl.style.alignItems = "center";
      destEl.style.justifyContent = "center";
      destEl.style.cursor = "pointer";
      destEl.style.position = "relative";

      if (passengerCount > 1) {
        // Show count badge for multiple passengers
        destEl.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <div style="position: absolute; top: -6px; right: -6px; background: #dc2626; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white;">${passengerCount}</div>
        `;
      } else {
        destEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
      }

      // Create carousel HTML for multiple passengers
      const createCarouselHTML = () => {
        if (passengerCount === 1) {
          const passenger = passengersAtDest[0];
          return `
            <div class="p-2">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </div>
                <div>
                  <strong class="block">${passenger.name}</strong>
                  <span class="text-xs text-orange-600 font-medium">DROP-OFF</span>
                </div>
              </div>
              <p class="text-xs text-gray-600 mb-1"><strong>Destination:</strong> ${
                passenger.destinationSubPoint || "N/A"
              }</p>
              <p class="text-xs text-gray-500">${
                passenger.destination || "N/A"
              }</p>
            </div>
          `;
        }

        // Multiple passengers - create carousel
        const carouselId = `carousel-${coordKey.replace(/[.,]/g, "-")}`;
        const passengersHTML = passengersAtDest
          .map(
            (passenger, index) => `
          <div class="carousel-slide" data-index="${index}" style="display: ${
            index === 0 ? "block" : "none"
          };">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </div>
              <div class="min-w-0 flex-1">
                <strong class="block truncate">${passenger.name}</strong>
                <span class="text-xs text-orange-600 font-medium">DROP-OFF</span>
              </div>
            </div>
            <p class="text-xs text-gray-600 mb-1"><strong>Destination:</strong> ${
              passenger.destinationSubPoint || "N/A"
            }</p>
            <p class="text-xs text-gray-500 truncate">${
              passenger.destination || "N/A"
            }</p>
          </div>
        `,
          )
          .join("");

        return `
          <div class="p-2" style="min-width: 220px;">
            <div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
              <span class="text-xs font-bold text-orange-600">${passengerCount} Passengers at this location</span>
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

      const destPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: "280px",
      }).setHTML(createCarouselHTML());

      // Carousel state tracking
      let currentSlide = 0;
      let closeTimeout: ReturnType<typeof setTimeout> | null = null;
      let isPopupOpen = false;

      const setupCarouselEvents = () => {
        if (passengerCount <= 1) return;

        const carouselId = `carousel-${coordKey.replace(/[.,]/g, "-")}`;
        const container = document.getElementById(carouselId);
        if (!container) return;

        const slides = container.querySelectorAll(".carousel-slide");
        const indicator = document.querySelector(
          `.carousel-indicator[data-carousel="${carouselId}"]`,
        );
        const prevBtn = document.querySelector(
          `.carousel-prev[data-carousel="${carouselId}"]`,
        );
        const nextBtn = document.querySelector(
          `.carousel-next[data-carousel="${carouselId}"]`,
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

        // Keep popup open when hovering over it
        const popupEl = destPopup.getElement();
        if (popupEl) {
          popupEl.addEventListener("mouseenter", () => {
            if (closeTimeout) {
              clearTimeout(closeTimeout);
              closeTimeout = null;
            }
          });

          popupEl.addEventListener("mouseleave", () => {
            closeTimeout = setTimeout(() => {
              destPopup.remove();
              isPopupOpen = false;
            }, 100);
          });
        }
      };

      // Hover handlers to show/hide popup
      destEl.addEventListener("mouseenter", () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        if (!isPopupOpen) {
          currentSlide = 0; // Reset to first slide
          // Re-set the HTML to get fresh DOM elements
          destPopup.setHTML(createCarouselHTML());
          destPopup.setLngLat(coordinates).addTo(map.current!);
          isPopupOpen = true;
          // Setup carousel events after popup is added to DOM
          setTimeout(setupCarouselEvents, 0);
        }
      });

      destEl.addEventListener("mouseleave", () => {
        closeTimeout = setTimeout(() => {
          destPopup.remove();
          isPopupOpen = false;
        }, 150);
      });

      const destMarker = new mapboxgl.Marker(destEl)
        .setLngLat(coordinates)
        .addTo(map.current!);

      markersRef.current.push(destMarker);
    });

    // Auto-fit map to show all markers
    if (markersRef.current.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();

      // Add checked/filtered driver coordinates
      driversToShow.forEach((driver) => bounds.extend(driver.coordinates));

      // Add all filtered passenger pickup coordinates
      filteredPassengers.forEach((passenger) =>
        bounds.extend(passenger.coordinates),
      );

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
        coord2: [number, number],
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
        locations: [number, number][],
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

      // Separate pickups and dropoffs
      const pickupCoordinates = currentPassengers.map((p) => p.coordinates);
      const dropoffCoordinates = currentPassengers
        .filter((p) => p.destinationCoordinates)
        .map((p) => p.destinationCoordinates!);

      // Optimize pickup order starting from driver location
      const optimizedPickups = optimizeRoute(
        currentDriver.coordinates,
        pickupCoordinates,
      );

      // Optimize dropoff order starting from last pickup location
      const lastPickupLocation =
        optimizedPickups.length > 0
          ? optimizedPickups[optimizedPickups.length - 1]
          : currentDriver.coordinates;
      const optimizedDropoffs = optimizeRoute(
        lastPickupLocation,
        dropoffCoordinates,
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
            route.geometry,
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
          bounds.extend(coord as [number, number]),
        );
        map.current.fitBounds(bounds, { padding: 80 });

        // Calculate distance saved by optimization
        // Calculate original (non-optimized) distance - simple sequential order
        if (currentPassengers.length > 1) {
          let originalDistance = 0;

          // Driver to first pickup
          originalDistance += getDistance(
            currentDriver.coordinates,
            pickupCoordinates[0],
          );

          // Sequential pickups
          for (let i = 0; i < pickupCoordinates.length - 1; i++) {
            originalDistance += getDistance(
              pickupCoordinates[i],
              pickupCoordinates[i + 1],
            );
          }

          // Last pickup to first dropoff
          if (dropoffCoordinates.length > 0) {
            originalDistance += getDistance(
              pickupCoordinates[pickupCoordinates.length - 1],
              dropoffCoordinates[0],
            );

            // Sequential dropoffs
            for (let i = 0; i < dropoffCoordinates.length - 1; i++) {
              originalDistance += getDistance(
                dropoffCoordinates[i],
                dropoffCoordinates[i + 1],
              );
            }
          }

          // Calculate distance with optimized route
          let optimizedDistance = 0;

          // Driver to first optimized pickup
          optimizedDistance += getDistance(
            currentDriver.coordinates,
            optimizedPickups[0],
          );

          // Optimized pickups
          for (let i = 0; i < optimizedPickups.length - 1; i++) {
            optimizedDistance += getDistance(
              optimizedPickups[i],
              optimizedPickups[i + 1],
            );
          }

          // Last pickup to first dropoff
          if (optimizedDropoffs.length > 0) {
            optimizedDistance += getDistance(
              optimizedPickups[optimizedPickups.length - 1],
              optimizedDropoffs[0],
            );

            // Optimized dropoffs
            for (let i = 0; i < optimizedDropoffs.length - 1; i++) {
              optimizedDistance += getDistance(
                optimizedDropoffs[i],
                optimizedDropoffs[i + 1],
              );
            }
          }

          const saved = Math.max(0, originalDistance - optimizedDistance);
          setDistanceSaved(saved);
        } else {
          setDistanceSaved(0);
        }
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
          shift,
        ),
      ]);

      if (isStaleRequest()) {
        return;
      }

      setDriversData(Array.isArray(driversResult) ? driversResult : []);
      setPassengersData(
        Array.isArray(passengersResult) ? passengersResult : [],
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

  const changeRouteColor = () => {
    const nextIndex = (routeColorIndex + 1) % routeColors.length;
    setRouteColorIndex(nextIndex);

    if (map.current && map.current.getLayer("route")) {
      map.current.setPaintProperty(
        "route",
        "line-color",
        routeColors[nextIndex].primary,
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
      name: `Route ${goingRoutes.length + 1}`,
      driverId: selectedDriver,
      passengerIds: selectedPassengers,
      routeInfo: routeInfo,
      color: routeColors[routeColorIndex],
      visible: true,
      createdAt: new Date().toISOString(),
      routeType: "going",
      driverSnapshot,
      passengerSnapshots,
      date: selectedDate,
      shift: selectedShift,
    };

    onSaveRoute(newRoute);
    clearSelections();
  };

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
        passengers.forEach((passenger) => bounds.extend(passenger.coordinates));
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 12 });
      } else {
        map.current.flyTo({ center: [-80.4925, 43.4516], zoom: 10 });
      }
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
                        dispatch(setGoingDate(e.target.value));
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
                            setGoingDate(
                              new Date().toISOString().split("T")[0],
                            ),
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
                            setGoingDate(tomorrow.toISOString().split("T")[0]),
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
                        dispatch(setGoingShift(shift));
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
          <div className="relative dropdown-container">
            <button
              onClick={() => {
                setShowDriverDropdown(!showDriverDropdown);
                setShowShiftDropdown(false);
                setShowPassengerDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
            >
              <Car className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="flex-1 text-left truncate hidden lg:block">
                Drivers
              </span>
              <span className="sm:hidden font-medium text-blue-600">
                {checkedDrivers.length > 0 ? checkedDrivers.length : ""}
              </span>
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
                                  (d) => normalizeTime(d.TIME || "") === time,
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
                            setCheckedDrivers((prev) =>
                              prev.includes(driver.id)
                                ? prev.filter((id) => id !== driver.id)
                                : [...prev, driver.id],
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
          <div className="relative dropdown-container">
            <button
              onClick={() => {
                setShowPassengerDropdown(!showPassengerDropdown);
                setShowShiftDropdown(false);
                setShowDriverDropdown(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 sm:py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
            >
              <Users className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="flex-1 text-left truncate hidden lg:block">
                Passengers
              </span>
              <span className="sm:hidden font-medium text-green-600">
                {selectedPassengers.length > 0 ? selectedPassengers.length : ""}
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
                    {/* Pickup City Filter */}
                    <select
                      value={pickupCityFilter}
                      onChange={(e) => setPickupCityFilter(e.target.value)}
                      className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {pickupCities.map((city) => (
                        <option key={city} value={city}>
                          {city === "All" ? "All Pickup" : city}
                        </option>
                      ))}
                    </select>

                    {/* Destination Filter */}
                    <select
                      value={destinationCityFilter}
                      onChange={(e) => setDestinationCityFilter(e.target.value)}
                      className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {destinationCities.map((city) => (
                        <option key={city} value={city}>
                          {city === "All" ? "All Dest" : city}
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
                                      timeFilter.filter((t) => t !== time),
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
                                  rawPassengerData.filter(
                                    (p) => p.TIME === time,
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
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            selectedPassengers.includes(passenger.id)
                              ? "bg-green-500"
                              : "bg-gray-200"
                          }`}
                        >
                          <Users
                            className={`w-5 h-5 ${
                              selectedPassengers.includes(passenger.id)
                                ? "text-white"
                                : "text-gray-600"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {passenger.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            <span>{passenger.subPoint}</span>
                            {passenger.destinationSubPoint && (
                              <>
                                <span>?</span>
                                <span className="text-orange-600">
                                  {passenger.destinationSubPoint}
                                </span>
                              </>
                            )}
                          </div>
                          {passenger.destination && (
                            <p className="text-xs text-gray-500">
                              Drop: {passenger.destination}
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

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 ">
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
                // Save data to Redux store
                dispatch(
                  saveRouteData({
                    routeType: "going",
                    shift: normalizedShift,
                    date: selectedDate,
                    drivers: driversData,
                    passengers: passengersData,
                  }),
                );
                setSaveDialogMessage(
                  `Data saved for ${selectedShift} shift (Going route)`,
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
              className="h-8 sm:h-9 px-2 sm:px-3 text-red-600 "
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
              Select a driver and passengers to calculate route
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

                  {distanceSaved > 0 && (
                    <>
                      <div className="w-px h-10 bg-gray-200"></div>

                      <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                        <Navigation className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-xs text-green-600 font-medium">
                            Route Optimized
                          </p>
                          <p className="font-bold text-sm text-green-700">
                            {distanceSaved.toFixed(1)} km saved
                          </p>
                        </div>
                      </div>
                    </>
                  )}

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
      </div>
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
    document.body,
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
