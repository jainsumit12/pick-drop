import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import {
  Eye,
  EyeOff,
  Trash2,
  MapPin,
  Clock,
  Ruler,
  Phone,
  User,
  ChevronDown,
  ChevronUp,
  FileDown,
} from "lucide-react";
import goingDriversData from "../../data/going-drivers.json";
import returnDriversData from "../../data/return-drivers.json";
import goingPassengersData from "../../data/going-passengers.json";
import returnPassengersData from "../../data/return-passengers.json";
import * as XLSX from "xlsx";
import { RouteParticipant, SavedRoute } from "../../types/route";
import { ShiftDriver, ShiftPassenger } from "../../types/transport";

interface SavedRoutesViewProps {
  savedRoutes: SavedRoute[];
  onDeleteRoute: (routeId: string) => void;
  onToggleVisibility: (routeId: string) => void;
}

interface Location {
  id: string;
  name: string;
  coordinates: [number, number];
  type: "driver" | "passenger";
  phone: string;
  address: string;
  subPoint: string;
  shiftTime: string;
  destinationCoordinates?: [number, number];
  destination?: string;
  destinationSubPoint?: string;
}
type RouteParticipantLike = Location | RouteParticipant;

// Helper function to extract clean name from rider name field
const extractCleanName = (fullName: string = ""): string => {
  if (!fullName) return "Unknown";
  const match = fullName.match(/^([^-]+)/);
  return match ? match[1].trim() : fullName;
};

// Helper function to extract ID from rider name or generate from name + location
const extractId = (fullName: string = "", location?: string): string => {
  if (!fullName) return Math.random().toString();
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

// Convert rider data to Location format
const convertRidersToLocations = (riders: ShiftDriver[]): Location[] => {
  return riders.flatMap((rider) => {
    const lat = parseCoordinate(rider.HOME_LAT);
    const log = parseCoordinate(rider.HOME_LOG);
    if (lat === null || log === null) return [];

    const phoneMatch = rider.DRIVER_NAME.match(/- (\d+)/);
    const phone = rider.DRIVER_PHONE || (phoneMatch ? phoneMatch[1] : "");

    return [
      {
        id: `${rider.SHIFT}-${extractId(rider.DRIVER_NAME, rider.HOME_LOCATION)}`,
        name: extractCleanName(rider.DRIVER_NAME),
        coordinates: [log, lat],
        type: "driver" as const,
        phone: phone,
        address: rider.HOME_LOCATION,
        subPoint: rider.DRIVER_SUBPOINT || rider.HOME_LOCATION,
        shiftTime: rider.SHIFT,
      },
    ];
  });
};

// Convert passenger data to Location format for GOING routes
const convertGoingPassengersToLocations = (
  passengers: ShiftPassenger[]
): Location[] => {
  // Group by shift to maintain correct index per shift
  const passengersByShift: { [key: string]: ShiftPassenger[] } = {};

  passengers
    .filter((passenger) => {
      const pickupLat = parseCoordinate(passenger.PICKUP_LAT);
      const pickupLog = parseCoordinate(passenger.PICKUP_LOG);
      return pickupLat !== null && pickupLog !== null;
    })
    .forEach((passenger) => {
      if (!passengersByShift[passenger.SHIFT]) {
        passengersByShift[passenger.SHIFT] = [];
      }
      passengersByShift[passenger.SHIFT].push(passenger);
    });

  // Convert to locations maintaining index per shift
  const allLocations: Location[] = [];
  Object.entries(passengersByShift).forEach(([shift, shiftPassengers]) => {
    shiftPassengers.forEach((passenger, index) => {
      allLocations.push({
        id: `passenger-${shift}-${passenger.NAME.replace(/\s+/g, "-")}-${index}`,
        name: extractCleanName(passenger.NAME),
        coordinates: [
          parseCoordinate(passenger.PICKUP_LOG)!,
          parseCoordinate(passenger.PICKUP_LAT)!,
        ],
        type: "passenger" as const,
        phone: passenger.MOBILE.toString(),
        address: passenger.PICKUP_LOCATION,
        subPoint: passenger.PICKUP_SUBPOINT || passenger.PICKUP_LOCATION,
        shiftTime: passenger.SHIFT,
        destinationCoordinates:
          parseCoordinate(passenger.DROP_LOG) !== null &&
          parseCoordinate(passenger.DROP_LAT) !== null
            ? [
                parseCoordinate(passenger.DROP_LOG)!,
                parseCoordinate(passenger.DROP_LAT)!,
              ]
            : undefined,
        destination: passenger.DROP_LOCATION,
        destinationSubPoint: passenger.DROP_SUBPOINT || passenger.DROP_LOCATION,
      });
    });
  });

  return allLocations;
};

// Convert passenger data to Location format for RETURN routes
const convertReturnPassengersToLocations = (
  passengers: ShiftPassenger[]
): Location[] => {
  // Group by shift to maintain correct index per shift
  const passengersByShift: { [key: string]: ShiftPassenger[] } = {};

  passengers
    .filter((passenger) => {
      const pickupLat = parseCoordinate(passenger.PICKUP_LAT);
      const pickupLog = parseCoordinate(passenger.PICKUP_LOG);
      const dropLat = parseCoordinate(passenger.DROP_LAT);
      const dropLog = parseCoordinate(passenger.DROP_LOG);
      return (
        pickupLat !== null &&
        pickupLog !== null &&
        dropLat !== null &&
        dropLog !== null
      );
    })
    .forEach((passenger) => {
      if (!passengersByShift[passenger.SHIFT]) {
        passengersByShift[passenger.SHIFT] = [];
      }
      passengersByShift[passenger.SHIFT].push(passenger);
    });

  // Convert to locations maintaining index per shift
  const allLocations: Location[] = [];
  Object.entries(passengersByShift).forEach(([shift, shiftPassengers]) => {
    shiftPassengers.forEach((passenger, index) => {
      allLocations.push({
        id: `passenger-${shift}-${passenger.NAME.replace(/\s+/g, "-")}-${index}`,
        name: extractCleanName(passenger.NAME),
        coordinates: [
          parseCoordinate(passenger.PICKUP_LOG)!,
          parseCoordinate(passenger.PICKUP_LAT)!,
        ], // Factory location
        type: "passenger" as const,
        phone: passenger.MOBILE.toString(),
        address: passenger.PICKUP_LOCATION,
        subPoint: passenger.PICKUP_SUBPOINT || passenger.PICKUP_LOCATION,
        shiftTime: passenger.SHIFT,
        destinationCoordinates: [
          parseCoordinate(passenger.DROP_LOG)!,
          parseCoordinate(passenger.DROP_LAT)!,
        ], // Home location
        destination: passenger.DROP_LOCATION,
        destinationSubPoint: passenger.DROP_SUBPOINT || passenger.DROP_LOCATION,
      });
    });
  });

  return allLocations;
};

export function SavedRoutesView({
  savedRoutes,
  onDeleteRoute,
  onToggleVisibility,
}: SavedRoutesViewProps) {
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const layerIdsRef = useRef<Set<string>>(new Set()); // Track all layer IDs

  // Track active tab
  const [activeTab, setActiveTab] = useState<"going" | "return">("going");

  // Track which routes are expanded/collapsed
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  // Convert all drivers to locations with IDs
  const allDrivers = convertRidersToLocations([
    ...(goingDriversData as ShiftDriver[]),
    ...(returnDriversData as ShiftDriver[]),
  ]);

  // Convert passengers separately for going and return routes
  const allGoingPassengers = convertGoingPassengersToLocations(
    goingPassengersData as ShiftPassenger[]
  );
  const allReturnPassengers = convertReturnPassengersToLocations(
    returnPassengersData as ShiftPassenger[]
  );

  // Use the appropriate passenger dataset based on active tab
  const allPassengers =
    activeTab === "going" ? allGoingPassengers : allReturnPassengers;

  const getDriverForRoute = (
    route: SavedRoute
  ): RouteParticipantLike | undefined =>
    route.driverSnapshot || allDrivers.find((d) => d.id === route.driverId);

  const getPassengersForRoute = (route: SavedRoute): RouteParticipantLike[] =>
    route.passengerSnapshots && route.passengerSnapshots.length > 0
      ? route.passengerSnapshots
      : allPassengers.filter((p) => route.passengerIds.includes(p.id));

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-79.9, 43.55],
        zoom: 9,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    } catch (error) {
      console.error("Error initializing map:", error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    if (!map.current.isStyleLoaded()) {
      map.current.once("load", () => {
        renderSavedRoutes();
      });
      return;
    }

    renderSavedRoutes();
  }, [savedRoutes, activeTab]); // Add activeTab to dependencies

  const renderSavedRoutes = () => {
    if (!map.current) return;

    // Remove all existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Remove ALL previously tracked layers and sources (including deleted routes)
    layerIdsRef.current.forEach((layerId) => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
      if (map.current!.getSource(layerId)) {
        map.current!.removeSource(layerId);
      }
    });

    // Clear the tracked layer IDs
    layerIdsRef.current.clear();

    // Filter routes by active tab
    const routesToShow = savedRoutes.filter(
      (route) => route.routeType === activeTab
    );

    // Add visible saved routes to map with markers (only from active tab)
    routesToShow.forEach((route) => {
      if (!route.visible) return;

      const layerId = `saved-route-${route.id}`;

      // Track this layer ID
      layerIdsRef.current.add(layerId);

      // Add route line
      if (!map.current!.getSource(layerId)) {
        map.current!.addSource(layerId, {
          type: "geojson",
          data: route.routeInfo.route,
        });

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
            "line-width": 4,
            "line-opacity": 0.75,
          },
        });
      }

      // Add driver marker
      const driverData = getDriverForRoute(route);
      if (driverData) {
        const el = document.createElement("div");
        el.style.width = "36px";
        el.style.height = "36px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = route.color.primary;
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;

        const marker = new mapboxgl.Marker(el)
          .setLngLat(driverData.coordinates)
          .setPopup(
            new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background-color: ${route.color.primary}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
                </div>
                <div>
                  <strong class="block">${driverData.name}</strong>
                  <span class="text-xs font-bold" style="color: ${route.color.primary}">DRIVER - ${route.name}</span>
                </div>
              </div>
              <p class="text-xs text-gray-600 mb-1"><strong>Location:</strong> ${driverData.subPoint}</p>
              <p class="text-xs text-gray-600 mb-1"><strong>Phone:</strong> ${driverData.phone}</p>
              <p class="text-xs text-gray-500">${driverData.address}</p>
            </div>
          `)
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      }

      // Add passenger markers
      const passengerDataList = getPassengersForRoute(route);
      passengerDataList.forEach((passenger) => {
        // Pickup marker
        const el = document.createElement("div");
        el.style.width = "30px";
        el.style.height = "30px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = route.color.primary;
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.opacity = "0.9";
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

        const marker = new mapboxgl.Marker(el)
          .setLngLat(passenger.coordinates)
          .setPopup(
            new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background-color: ${route.color.primary}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
                <div>
                  <strong class="block">${passenger.name}</strong>
                  <span class="text-xs font-bold" style="color: ${route.color.primary}">PICKUP - ${route.name}</span>
                </div>
              </div>
              <p class="text-xs text-gray-600 mb-1"><strong>Location:</strong> ${passenger.subPoint}</p>
              <p class="text-xs text-gray-600 mb-1"><strong>Phone:</strong> ${passenger.phone}</p>
              <p class="text-xs text-gray-500 mb-2">${passenger.address}</p>
              ${passenger.destinationSubPoint ? `<p class="text-xs text-orange-600 font-medium"><strong>Destination:</strong> ${passenger.destinationSubPoint}</p>` : ""}
            </div>
          `)
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });

      // Group passengers by destination coordinates for drop-off markers
      const destinationGroups = new Map<string, RouteParticipantLike[]>();
      passengerDataList.forEach((passenger) => {
        if (passenger.destinationCoordinates) {
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
        destEl.style.width = passengerCount > 1 ? "32px" : "26px";
        destEl.style.height = passengerCount > 1 ? "32px" : "26px";
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
          destEl.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <div style="position: absolute; top: -6px; right: -6px; background: #dc2626; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white;">${passengerCount}</div>
          `;
        } else {
          destEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
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
                    <span class="text-xs text-orange-600 font-medium">DROP-OFF - ${route.name}</span>
                  </div>
                </div>
                <p class="text-xs text-gray-600 mb-1"><strong>Destination:</strong> ${passenger.destinationSubPoint || "N/A"}</p>
                <p class="text-xs text-gray-500">${passenger.destination || "N/A"}</p>
              </div>
            `;
          }

          // Multiple passengers - create carousel
          const carouselId = `carousel-${route.id}-${coordKey.replace(/[.,]/g, "-")}`;
          const passengersHTML = passengersAtDest.map((passenger, index) => `
            <div class="carousel-slide" data-index="${index}" style="display: ${index === 0 ? "block" : "none"};">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </div>
                <div class="min-w-0 flex-1">
                  <strong class="block truncate">${passenger.name}</strong>
                  <span class="text-xs text-orange-600 font-medium">DROP-OFF - ${route.name}</span>
                </div>
              </div>
              <p class="text-xs text-gray-600 mb-1"><strong>Destination:</strong> ${passenger.destinationSubPoint || "N/A"}</p>
              <p class="text-xs text-gray-500 truncate">${passenger.destination || "N/A"}</p>
            </div>
          `).join("");

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

          const carouselId = `carousel-${route.id}-${coordKey.replace(/[.,]/g, "-")}`;
          const container = document.getElementById(carouselId);
          if (!container) return;

          const slides = container.querySelectorAll(".carousel-slide");
          const indicator = document.querySelector(`.carousel-indicator[data-carousel="${carouselId}"]`);
          const prevBtn = document.querySelector(`.carousel-prev[data-carousel="${carouselId}"]`);
          const nextBtn = document.querySelector(`.carousel-next[data-carousel="${carouselId}"]`);

          const showSlide = (index: number) => {
            slides.forEach((slide, i) => {
              (slide as HTMLElement).style.display = i === index ? "block" : "none";
            });
            if (indicator) {
              indicator.textContent = `${index + 1} / ${passengerCount}`;
            }
            currentSlide = index;
          };

          prevBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            const newIndex = currentSlide === 0 ? passengerCount - 1 : currentSlide - 1;
            showSlide(newIndex);
          });

          nextBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            const newIndex = currentSlide === passengerCount - 1 ? 0 : currentSlide + 1;
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
            currentSlide = 0;
            destPopup.setHTML(createCarouselHTML());
            destPopup.setLngLat(coordinates).addTo(map.current!);
            isPopupOpen = true;
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
    });

    // Auto-fit map to show all visible routes (only from active tab)
    if (routesToShow.some((r) => r.visible)) {
      const bounds = new mapboxgl.LngLatBounds();
      let hasValidCoordinates = false;

      routesToShow.forEach((route) => {
        if (!route.visible) return;

        const driverData = getDriverForRoute(route);
        if (
          driverData &&
          driverData.coordinates &&
          driverData.coordinates.length === 2
        ) {
          bounds.extend(driverData.coordinates);
          hasValidCoordinates = true;
        }

        const passengerDataList = getPassengersForRoute(route);
        passengerDataList.forEach((passenger) => {
          if (passenger.coordinates && passenger.coordinates.length === 2) {
            bounds.extend(passenger.coordinates);
            hasValidCoordinates = true;
          }
          if (
            passenger.destinationCoordinates &&
            passenger.destinationCoordinates.length === 2
          ) {
            bounds.extend(passenger.destinationCoordinates);
            hasValidCoordinates = true;
          }
        });
      });

      // Only fit bounds if we have valid coordinates
      if (hasValidCoordinates && map.current) {
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 12 });
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter routes by type
  const goingRoutes = savedRoutes.filter(
    (route) => route.routeType === "going"
  );
  const returnRoutes = savedRoutes.filter(
    (route) => route.routeType === "return"
  );

  // Toggle route expansion
  const toggleRouteExpansion = (routeId: string) => {
    setExpandedRoutes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(routeId)) {
        newSet.delete(routeId);
      } else {
        newSet.add(routeId);
      }
      return newSet;
    });
  };

  // Export routes to Excel
  const exportToExcel = (routeType: "going" | "return") => {
    const routesToExport = savedRoutes.filter(
      (route) => route.routeType === routeType
    );

    if (routesToExport.length === 0) {
      alert(`No ${routeType} routes to export`);
      return;
    }

    // Prepare data for Excel
    const excelData: any[] = [];

    routesToExport.forEach((route) => {
      const driverData = getDriverForRoute(route);
      const passengerDataList = getPassengersForRoute(route);

      // Add route summary row
      excelData.push({
        "Route Name": route.name,
        Type: routeType.charAt(0).toUpperCase() + routeType.slice(1),
        "Created At": formatDate(route.createdAt),
        "Distance (km)": route.routeInfo.distance.toFixed(2),
        "Duration (min)": Math.round(route.routeInfo.duration),
        "Route Color": route.color.name,
        Role: "",
        Name: "",
        Phone: "",
        "Pickup Location": "",
        "Drop Location": "",
      });

      // Add driver row
      if (driverData) {
        excelData.push({
          "Route Name": "",
          Type: "",
          "Created At": "",
          "Distance (km)": "",
          "Duration (min)": "",
          "Route Color": "",
          Role: "Driver",
          Name: driverData.name,
          Phone: driverData.phone,
          "Pickup Location": driverData.address,
          "Drop Location": "",
        });
      }

      // Add passenger rows
      passengerDataList.forEach((passenger) => {
        excelData.push({
          "Route Name": "",
          Type: "",
          "Created At": "",
          "Distance (km)": "",
          "Duration (min)": "",
          "Route Color": "",
          Role: "Passenger",
          Name: passenger.name,
          Phone: passenger.phone,
          "Pickup Location": passenger.address,
          "Drop Location": passenger.destination || "",
        });
      });

      // Add empty row for spacing
      excelData.push({
        "Route Name": "",
        Type: "",
        "Created At": "",
        "Distance (km)": "",
        "Duration (min)": "",
        "Route Color": "",
        Role: "",
        Name: "",
        Phone: "",
        "Pickup Location": "",
        "Drop Location": "",
      });
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 20 }, // Route Name
      { wch: 10 }, // Type
      { wch: 20 }, // Created At
      { wch: 12 }, // Distance
      { wch: 12 }, // Duration
      { wch: 15 }, // Route Color
      { wch: 12 }, // Role
      { wch: 20 }, // Name
      { wch: 15 }, // Phone
      { wch: 35 }, // Pickup Location
      { wch: 35 }, // Drop Location
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `${routeType.charAt(0).toUpperCase() + routeType.slice(1)} Routes`
    );

    // Generate filename with current date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const filename = `${routeType}_routes_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  // Render route cards
  const renderRouteCards = (routes: SavedRoute[]) =>
    routes.length === 0 ? (
      <Card>
        <CardContent className="py-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No saved routes yet</p>
          <p className="text-sm text-gray-500">
            Create your first route to get started
          </p>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-3">
        {routes.map((route) => {
          // Find driver and passengers using the generated IDs
          const driverData = getDriverForRoute(route);
          const passengerDataList = getPassengersForRoute(route);
          const isExpanded = expandedRoutes.has(route.id);

          return (
            <Card
              key={route.id}
              className={`transition-all ${
                route.visible
                  ? "border-2 border-blue-500 shadow-md"
                  : "border-2 border-gray-200"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => toggleRouteExpansion(route.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <div
                      style={{
                        width: "4px",
                        height: "40px",
                        backgroundColor: route.color.primary,
                        borderRadius: "2px",
                      }}
                    />
                    <div className="flex-1">
                      <CardTitle className="text-base">{route.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {formatDate(route.createdAt)}
                        </p>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-blue-600 font-medium">
                          {route.routeInfo.distance.toFixed(1)} km •{" "}
                          {Math.round(route.routeInfo.duration)} min
                        </p>
                      </div>
                    </div>
                    <div className="ml-2">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggleVisibility(route.id)}
                      title={route.visible ? "Hide route" : "Show route"}
                    >
                      {route.visible ? (
                        <Eye className="w-4 h-4 text-blue-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteRoute(route.id)}
                      title="Delete route"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Ruler className="w-4 h-4" />
                        <span>Distance</span>
                      </div>
                      <span className="font-semibold text-blue-600">
                        {route.routeInfo.distance.toFixed(1)} km
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Duration</span>
                      </div>
                      <span className="font-semibold text-green-600">
                        {Math.round(route.routeInfo.duration)} min
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      Driver
                    </p>
                    {driverData ? (
                      <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-900">
                            {driverData.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">
                            {driverData.phone}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Driver not found</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      Passengers ({passengerDataList.length})
                    </p>
                    <div className="space-y-2">
                      {passengerDataList.length > 0 ? (
                        passengerDataList.map((passenger) => (
                          <div
                            key={passenger.id}
                            className="bg-green-50 rounded-lg p-3 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {passenger.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-gray-700">
                                {passenger.phone}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-green-600 mt-0.5" />
                              <span className="text-sm text-gray-700">
                                <span className="font-semibold text-gray-600">
                                  Pickup:
                                </span>{" "}
                                {passenger.address}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-orange-500 mt-0.5" />
                              <span className="text-sm text-gray-700">
                                <span className="font-semibold text-gray-600">
                                  Drop:
                                </span>{" "}
                                {passenger.destination || "N/A"}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500">
                          No passengers found
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: "24px",
                          height: "4px",
                          backgroundColor: route.color.primary,
                          borderRadius: "2px",
                        }}
                      />
                      <span className="text-xs text-gray-600">
                        Route Color: {route.color.name}
                      </span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    );

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-96 bg-white border-r overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-xl font-bold">Saved Routes</h2>
            <p className="text-sm text-gray-600 mt-1">
              {savedRoutes.length}{" "}
              {savedRoutes.length === 1 ? "route" : "routes"} saved
            </p>
          </div>

          <Tabs
            defaultValue="going"
            className="w-full"
            onValueChange={(value) => setActiveTab(value as "going" | "return")}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <TabsList className="flex-1">
                <TabsTrigger value="going" className="flex-1">
                  Going Routes ({goingRoutes.length})
                </TabsTrigger>
                <TabsTrigger value="return" className="flex-1">
                  Return Routes ({returnRoutes.length})
                </TabsTrigger>
              </TabsList>
              <Button
                onClick={() => exportToExcel(activeTab)}
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={
                  activeTab === "going"
                    ? goingRoutes.length === 0
                    : returnRoutes.length === 0
                }
              >
                <FileDown className="w-4 h-4" />
                Export
              </Button>
            </div>

            <TabsContent value="going" className="mt-4">
              {renderRouteCards(goingRoutes)}
            </TabsContent>

            <TabsContent value="return" className="mt-4">
              {renderRouteCards(returnRoutes)}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 relative bg-gray-200">
        <div
          ref={mapContainer}
          className="w-full h-full"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {savedRoutes.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-6 py-4 rounded-lg shadow-lg z-10 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No routes to display</p>
          </div>
        )}

        {savedRoutes.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-lg z-10">
            <p className="text-sm text-gray-600">
              Showing {savedRoutes.filter((r) => r.visible).length} of{" "}
              {savedRoutes.length} routes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
