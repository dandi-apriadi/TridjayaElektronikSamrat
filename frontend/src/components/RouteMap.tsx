import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom SVG Icons for better reliability and aesthetics
const createCustomIcon = (color: string) => L.divIcon({
  html: `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21C16 17 20 13.5 20 9C20 4.5 16.5 1 12 1C7.5 1 4 4.5 4 9C4 13.5 8 17 12 21Z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="9" r="3" fill="white"/>
    </svg>
  `,
  className: 'custom-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const storeIcon = createCustomIcon('#06b6d4'); // Cyan for store
const destIcon = createCustomIcon('#f43f5e');  // Rose for destination

interface RouteMapProps {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}

const ChangeView = ({ bounds }: { bounds: L.LatLngBoundsExpression }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds) {
      // Small delay to ensure container has finished animating/resizing
      const timer = setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(bounds, { 
          padding: [20, 20],
          maxZoom: 16,
          animate: true 
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [bounds, map]);

  return null;
};

const RouteMap: React.FC<RouteMapProps> = ({ origin, destination }) => {
  const [routeData, setRouteData] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRoute = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const coordinates = data.routes[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
          );
          setRouteData(coordinates);
        } else {
          setRouteData([[origin.latitude, origin.longitude], [destination.latitude, destination.longitude]]);
        }
      } catch (error) {
        setRouteData([[origin.latitude, origin.longitude], [destination.latitude, destination.longitude]]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoute();
  }, [origin, destination]);

  const bounds = useMemo(() => {
    const b = L.latLngBounds([origin.latitude, origin.longitude], [destination.latitude, destination.longitude]);
    if (routeData.length > 0) {
      routeData.forEach(coord => b.extend(coord));
    }
    return b;
  }, [origin, destination, routeData]);

  return (
    <div className="h-full w-full relative bg-surface-container-lowest">
      <MapContainer
        center={[origin.latitude, origin.longitude]}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
        zoomControl={true}
        style={{ background: '#1e293b' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Marker position={[origin.latitude, origin.longitude]} icon={storeIcon}>
          <Popup>Toko Tridjaya Manado</Popup>
        </Marker>
        
        <Marker position={[destination.latitude, destination.longitude]} icon={destIcon}>
          <Popup>Lokasi Tujuan</Popup>
        </Marker>
        
        {routeData.length > 0 && (
          <>
            {/* Outer shadow for the route */}
            <Polyline 
              positions={routeData} 
              color="#0891b2" 
              weight={8} 
              opacity={0.3}
            />
            {/* Main route line */}
            <Polyline 
              positions={routeData} 
              color="#22d3ee" 
              weight={4} 
              opacity={1}
              lineJoin="round"
            />
          </>
        )}
        
        <ChangeView bounds={bounds} />
      </MapContainer>
      
      {isLoading && (
        <div className="absolute inset-0 bg-surface/20 backdrop-blur-[1px] z-[1000] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Map Legend/Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-surface-container/90 backdrop-blur-md p-2 rounded-lg border border-outline-variant/20 shadow-xl pointer-events-none">
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-neon-cyan-sm"></div>
            <span className="text-white">Asal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500 shadow-neon-rose-sm"></div>
            <span className="text-white">Tujuan</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteMap;
