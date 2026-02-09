import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Route as RouteIcon, LogOut, User, FolderOpen, Settings, ArrowRight, ArrowLeft, Layers } from 'lucide-react';
import { Button } from './ui/button';
import { CreateRoute } from './CreateRoute';
import { ReturnRoute } from './ReturnRoute';
import { SavedRoutesView } from './SavedRoutesView';
import { MapboxSettings } from './MapboxSettings';
import { CombinedRoute } from './CombinedRoute';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addRoute, deleteRoute, toggleRouteVisibility, clearRoutesByType } from '../../store/slices/routesSlice';
import {
  setGoingDate, setGoingShift, setGoingDriver, setGoingPassengers, setGoingEditingRouteId,
  setReturnDate, setReturnShift, setReturnDriver, setReturnPassengers, setReturnEditingRouteId,
} from '../../store/slices/filterSlice';
import { SavedRoute } from '../../types/route';

interface DashboardProps {
  user: { username: string; role: string };
  onLogout: () => void;
}

type MenuItem = 'going' | 'return' | 'combined' | 'saved' | 'settings';

export function Dashboard({ user, onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const savedRoutes = useAppSelector((state) => state.routes.savedRoutes);

  const getActiveMenuItem = (): MenuItem => {
    const path = location.pathname.split('/').pop();
    return (path as MenuItem) || 'going';
  };

  const activeMenuItem = getActiveMenuItem();

  const menuItems = [
    { id: 'going' as MenuItem, label: 'Going Route', icon: ArrowRight, path: '/dashboard/going' },
    { id: 'return' as MenuItem, label: 'Return Route', icon: ArrowLeft, path: '/dashboard/return' },
    { id: 'combined' as MenuItem, label: 'Combined', icon: Layers, path: '/dashboard/combined' },
    { id: 'saved' as MenuItem, label: 'Saved Routes', icon: FolderOpen, badge: savedRoutes.length, path: '/dashboard/saved' },
    { id: 'settings' as MenuItem, label: 'Mapbox Settings', icon: Settings, path: '/dashboard/settings' },
  ];

  const handleSaveRoute = (route: SavedRoute) => {
    dispatch(addRoute(route));
    navigate('/dashboard/saved');
  };

  const handleDeleteRoute = (routeId: string) => {
    dispatch(deleteRoute(routeId));
  };

  const handleToggleVisibility = (routeId: string) => {
    dispatch(toggleRouteVisibility(routeId));
  };

  const handleClearRoutes = (routeType: 'going' | 'return') => {
    dispatch(clearRoutesByType(routeType));
  };

  const handleEditRoute = (route: SavedRoute) => {
    if (route.routeType === 'going') {
      dispatch(setGoingDate(route.date));
      dispatch(setGoingShift(route.shift));
      dispatch(setGoingDriver(route.driverId));
      dispatch(setGoingPassengers(route.passengerIds));
      dispatch(setGoingEditingRouteId(route.id));
    } else {
      dispatch(setReturnDate(route.date));
      dispatch(setReturnShift(route.shift));
      dispatch(setReturnDriver(route.driverId));
      dispatch(setReturnPassengers(route.passengerIds));
      dispatch(setReturnEditingRouteId(route.id));
    }
    navigate(`/dashboard/${route.routeType}`);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b shadow-sm z-20">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left Side - Logo & Title */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <RouteIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Route Planner Dashboard</h1>
                  <p className="text-xs text-gray-500">Kitchener-Toronto Region</p>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200"></div>

              {/* Navigation Menu Items */}
              <div className="flex items-center gap-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeMenuItem === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className="hidden md:inline">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Side - User Profile */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden h-full">
        <Routes>
          <Route path="going" element={<CreateRoute savedRoutes={savedRoutes} onSaveRoute={handleSaveRoute} />} />
          <Route path="return" element={<ReturnRoute onSaveRoute={handleSaveRoute} />} />
          <Route path="combined" element={<CombinedRoute savedRoutes={savedRoutes} onSaveRoute={handleSaveRoute} />} />
          <Route
            path="saved"
            element={
              <SavedRoutesView
                savedRoutes={savedRoutes}
                onDeleteRoute={handleDeleteRoute}
                onToggleVisibility={handleToggleVisibility}
                onClearRoutes={handleClearRoutes}
                onEditRoute={handleEditRoute}
              />
            }
          />
          <Route path="settings" element={<MapboxSettings />} />
          <Route path="/" element={<Navigate to="going" replace />} />
        </Routes>
      </main>
    </div>
  );
}
