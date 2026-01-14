import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Key, CheckCircle, XCircle, Map, Settings, Info } from 'lucide-react';
import mapboxgl from 'mapbox-gl';

export function MapboxSettings() {
  const [apiToken, setApiToken] = useState(mapboxgl.accessToken || '');
  const [tempToken, setTempToken] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSaveToken = () => {
    mapboxgl.accessToken = tempToken;
    setApiToken(tempToken);
    setIsEditing(false);
    setTestResult(null);
  };

  const handleCancelEdit = () => {
    setTempToken('');
    setIsEditing(false);
    setTestResult(null);
  };

  const handleTestToken = async () => {
    if (!tempToken) {
      setTestResult({
        success: false,
        message: 'Please enter a token first'
      });
      return;
    }

    setIsTesting(true);
    
    try {
      // Test the token by making a simple geocoding request
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/Toronto.json?access_token=${tempToken}`
      );
      
      if (response.ok) {
        setTestResult({
          success: true,
          message: 'Token is valid and working!'
        });
      } else {
        setTestResult({
          success: false,
          message: 'Invalid token or API error'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to test token. Please check your connection.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const maskToken = (token: string) => {
    if (!token) return '';
    if (token.length < 20) return token;
    return `${token.substring(0, 15)}...${token.substring(token.length - 10)}`;
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-7 h-7 text-blue-600" />
            Mapbox Settings
          </h2>
          <p className="text-gray-600 mt-1">Configure your Mapbox API settings and preferences</p>
        </div>

        {/* API Token Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Access Token
            </CardTitle>
            <CardDescription>
              Your Mapbox API token is required for map functionality and route calculations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditing ? (
              <>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Current Token</span>
                    <Badge variant={apiToken ? 'default' : 'secondary'}>
                      {apiToken ? 'Active' : 'Not Set'}
                    </Badge>
                  </div>
                  <div className="font-mono text-sm text-gray-600 bg-white p-3 rounded border">
                    {apiToken ? maskToken(apiToken) : 'No token configured'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setIsEditing(true)}>
                    <Key className="w-4 h-4 mr-2" />
                    Update Token
                  </Button>
                  {apiToken && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setTempToken(apiToken);
                        setIsTesting(true);
                        handleTestToken();
                      }}
                    >
                      Test Current Token
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    New API Token
                  </label>
                  <Input
                    type="text"
                    placeholder="pk.eyJ1Ijoic2lk..."
                    value={tempToken}
                    onChange={(e) => setTempToken(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Get your token from <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Mapbox Account</a>
                  </p>
                </div>

                {testResult && (
                  <div className={`flex items-start gap-2 p-3 rounded-lg border ${
                    testResult.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <p className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {testResult.message}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={handleTestToken}
                    variant="outline"
                    disabled={isTesting || !tempToken}
                  >
                    {isTesting ? 'Testing...' : 'Test Token'}
                  </Button>
                  <Button 
                    onClick={handleSaveToken}
                    disabled={!tempToken || (testResult && !testResult.success)}
                  >
                    Save Token
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Map Settings Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="w-5 h-5" />
              Map Configuration
            </CardTitle>
            <CardDescription>
              Current map settings and defaults
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Map Style</p>
                <p className="font-medium">Mapbox Streets v12</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Default Center</p>
                <p className="font-medium font-mono text-sm">[-79.9, 43.55]</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Default Zoom</p>
                <p className="font-medium">Level 9</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Region</p>
                <p className="font-medium">Kitchener-Toronto, ON</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Route Calculation Settings
            </CardTitle>
            <CardDescription>
              Settings for route planning and optimization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Routing Profile</p>
                <p className="font-medium">Driving</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">API Version</p>
                <p className="font-medium">Directions v5</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Geometry Format</p>
                <p className="font-medium">GeoJSON</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Available Colors</p>
                <div className="flex gap-1 mt-1">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                  <div className="w-4 h-4 rounded-full bg-pink-500"></div>
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help & Information */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Info className="w-5 h-5" />
              Help & Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>Getting Started:</strong> You need a Mapbox access token to use the map and routing features.
            </p>
            <p>
              <strong>How to get a token:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Visit <a href="https://account.mapbox.com/" target="_blank" rel="noopener noreferrer" className="underline">account.mapbox.com</a></li>
              <li>Sign up for a free account or log in</li>
              <li>Navigate to "Access Tokens"</li>
              <li>Copy your default public token or create a new one</li>
              <li>Paste it in the API Token field above</li>
            </ol>
            <p className="pt-2">
              <strong>Note:</strong> Free tier includes 100,000 requests per month, which is suitable for development and small projects.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
