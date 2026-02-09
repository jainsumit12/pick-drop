import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setCombinedStep,
  setReturnDate,
  setReturnShift,
  setReturnDriver,
} from "../../store/slices/filterSlice";
import { addPendingGoingRoute, clearPendingGoingRoutes } from "../../store/slices/routesSlice";
import { SavedRoute } from "../../types/route";
import { CreateRoute } from "./CreateRoute";
import { ReturnRoute } from "./ReturnRoute";

interface CombinedRouteProps {
  savedRoutes: SavedRoute[];
  onSaveRoute: (route: SavedRoute) => void;
}

export function CombinedRoute({ savedRoutes, onSaveRoute }: CombinedRouteProps) {
  const dispatch = useAppDispatch();
  const combined = useAppSelector((state) => state.filters.combined) ?? {
    currentStep: "going" as const,
  };
  const goingFilters = useAppSelector((state) => state.filters.going);
  const returnFilters = useAppSelector((state) => state.filters.return);
  const pendingGoingRoutes = useAppSelector((state) => state.routes.pendingGoingRoutes) ?? [];
  const [returnFetchTrigger, setReturnFetchTrigger] = useState(0);

  const currentStep = combined.currentStep ?? "going";

  // Compute driver location overrides from pending going routes
  // Each driver should appear at the endpoint of their going route (last passenger drop-off)
  const driverLocationOverrides = useMemo(() => {
    const overrides: Record<string, [number, number]> = {};
    pendingGoingRoutes.forEach((route) => {
      const routeCoords = route.routeInfo?.route?.coordinates;
      if (routeCoords && routeCoords.length > 0) {
        const lastCoord = routeCoords[routeCoords.length - 1];
        overrides[route.driverId] = [lastCoord[0], lastCoord[1]];
      }
    });
    return Object.keys(overrides).length > 0 ? overrides : undefined;
  }, [pendingGoingRoutes]);

  const handleStepChange = (step: "going" | "return") => {
    dispatch(setCombinedStep(step));
  };

  useEffect(() => {
    if (!goingFilters?.selectedDate || !goingFilters?.selectedShift) return;
    if (returnFilters?.selectedDate !== goingFilters.selectedDate) {
      dispatch(setReturnDate(goingFilters.selectedDate));
    }
    if (returnFilters?.selectedShift !== goingFilters.selectedShift) {
      dispatch(setReturnShift(goingFilters.selectedShift));
    }
  }, [
    dispatch,
    goingFilters.selectedDate,
    goingFilters.selectedShift,
    returnFilters?.selectedDate,
    returnFilters?.selectedShift,
  ]);

  const handleGoingSave = (route: SavedRoute) => {
    dispatch(addPendingGoingRoute(route));
    dispatch(setReturnDriver(route.driverId ?? null));
    dispatch(setCombinedStep("return"));
  };

  const handleReturnSave = (route: SavedRoute) => {
    pendingGoingRoutes.forEach((pendingRoute) => {
      onSaveRoute(pendingRoute);
    });
    onSaveRoute(route);
    dispatch(clearPendingGoingRoutes());
    dispatch(setCombinedStep("going"));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Step Toggle Bar */}
      <div className="bg-white border-b z-30">
        <div className="flex items-center justify-end px-4 py-1.5">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleStepChange("going")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currentStep === "going"
                  ? "bg-white shadow text-blue-700"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <ArrowRight className="w-4 h-4" />
              Going
            </button>
            <button
              onClick={() => handleStepChange("return")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currentStep === "return"
                  ? "bg-white shadow text-blue-700"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Return
            </button>
          </div>
        </div>
      </div>

      {/* Route Builder Content */}
      <div className="flex-1 overflow-hidden">
        {currentStep === "going" ? (
          <CreateRoute
            savedRoutes={savedRoutes}
            onSaveRoute={handleGoingSave}
            onFetchCombined={() => setReturnFetchTrigger((prev) => prev + 1)}
            showQueueButton={false}
          />
        ) : (
          <ReturnRoute
            onSaveRoute={handleReturnSave}
            driverLocationOverrides={driverLocationOverrides}
            fetchTrigger={returnFetchTrigger}
            showQueueButton={false}
            combinedQueuedDrivers={pendingGoingRoutes
              .map((route) => route.driverSnapshot)
              .filter((driver): driver is NonNullable<typeof driver> => Boolean(driver))}
          />
        )}
      </div>
    </div>
  );
}
