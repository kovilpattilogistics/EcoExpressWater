import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React Leaflet
// (Not strictly necessary if we use custom icon, but good for safety)

const createMapIcon = () => {
    return L.divIcon({
        className: 'custom-map-icon',
        html: `<div style="background-color: #4CAF50; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
};

interface LocationPickerMapProps {
    onLocationSelect: (lat: number, lng: number) => void;
    initialLat?: number;
    initialLng?: number;
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
    onLocationSelect,
    initialLat = 9.1726,
    initialLng = 77.8808
}) => {
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
            if (lat && lng) map.flyTo([lat, lng], map.getZoom());
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
            <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {position && <Marker position={position} icon={createMapIcon()} />}
            <MapEvents />
            <RecenterAutomatically lat={initialLat || 9.1726} lng={initialLng || 77.8808} />
        </MapContainer>
    );
};
