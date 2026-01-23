import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { OpenStreetMapProvider, GeoSearchControl } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';
import L from 'leaflet';
import { Navigation, MapPin } from 'lucide-react';

// Fix for default Leaflet marker icons in React
const createMapIcon = () => {
    return L.divIcon({
        className: 'custom-map-icon',
        html: `<div style="background-color: #4CAF50; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
};

const SearchControl: React.FC<{ onResult: (lat: number, lng: number) => void }> = ({ onResult }) => {
    const map = useMap();

    useEffect(() => {
        // @ts-ignore
        const provider = new OpenStreetMapProvider();
        // @ts-ignore
        const searchControl = new GeoSearchControl({
            provider: provider,
            style: 'bar',
            showMarker: false,
            retainZoomLevel: false,
            animateZoom: true,
            autoClose: true,
            searchLabel: 'Search for address...',
            keepResult: true,
            zoomLevel: 17, // Zoom to < 1km view
        });

        map.addControl(searchControl);

        const handleShowLocation = (result: any) => {
            if (result && result.location) {
                onResult(Number(result.location.y), Number(result.location.x));
            }
        };

        // @ts-ignore
        map.on('geosearch/showlocation', handleShowLocation);

        return () => {
            map.removeControl(searchControl);
            // @ts-ignore
            map.off('geosearch/showlocation', handleShowLocation);
        };
    }, [map, onResult]);

    return null;
};

export const LocationPickerMap: React.FC<{
    onLocationSelect: (lat: number, lng: number) => void,
    initialLat?: number,
    initialLng?: number
}> = ({ onLocationSelect, initialLat = 9.1726, initialLng = 77.8808 }) => {
    const [position, setPosition] = useState<L.LatLng | null>(
        initialLat && initialLng ? new L.LatLng(initialLat, initialLng) : new L.LatLng(9.1726, 77.8808)
    );

    const MapEvents = () => {
        useMapEvents({
            click(e) {
                setPosition(e.latlng);
                onLocationSelect(e.latlng.lat, e.latlng.lng);
            },
        });
        return null;
    };

    const RecenterAutomatically = ({ lat, lng }: { lat: number, lng: number }) => {
        const map = useMap();
        useEffect(() => {
            if (lat && lng) map.flyTo([lat, lng], 17);
        }, [lat, lng]);
        return null;
    }

    return (
        <MapContainer
            center={[initialLat || 9.1726, initialLng || 77.8808]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <SearchControl onResult={(lat, lng) => {
                setPosition(new L.LatLng(lat, lng));
                onLocationSelect(lat, lng);
            }} />
            {position && <Marker position={position} icon={createMapIcon()} />}
            <MapEvents />
            <RecenterAutomatically lat={initialLat || 9.1726} lng={initialLng || 77.8808} />
        </MapContainer>
    );
};
