import { useEffect, useRef, useState } from 'react';
import { MapPin, Locate, Check, X } from 'lucide-react';

interface MapPickerProps {
  onConfirm: (address: string, lat: number, lng: number) => void;
  onClose: () => void;
  initialLat?: number;
  initialLng?: number;
}

export const MapPicker = ({ onConfirm, onClose, initialLat, initialLng }: MapPickerProps) => {
  const mapRef    = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markerRef  = useRef<any>(null);

  const [address,   setAddress]   = useState('Drag pin to select location');
  const [lat,       setLat]       = useState(initialLat || 20.5937);
  const [lng,       setLng]       = useState(initialLng || 78.9629);
  const [loading,   setLoading]   = useState(false);
  const [locating,  setLocating]  = useState(false);

  const reverseGeocode = async (la: number, lo: number) => {
    setLoading(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await r.json();
      setAddress(data.display_name || `${la.toFixed(5)}, ${lo.toFixed(5)}`);
    } catch {
      setAddress(`${la.toFixed(5)}, ${lo.toFixed(5)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [lat, lng],
        zoom:   15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom red pin icon
      const pinIcon = L.divIcon({
        html: `<div style="
          width:32px;height:40px;position:relative;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));
        ">
          <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C9.373 0 4 5.373 4 12c0 9 12 28 12 28s12-19 12-28C28 5.373 22.627 0 16 0z" fill="#ef4444"/>
            <circle cx="16" cy="12" r="5" fill="white"/>
          </svg>
        </div>`,
        className: '',
        iconSize:    [32, 40],
        iconAnchor:  [16, 40],
        popupAnchor: [0, -40],
      });

      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        setLat(pos.lat);
        setLng(pos.lng);
        reverseGeocode(pos.lat, pos.lng);
      });

      // Click on map moves pin
      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        setLat(e.latlng.lat);
        setLng(e.latlng.lng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      leafletRef.current = map;
      markerRef.current  = marker;

      // Initial reverse geocode
      reverseGeocode(lat, lng);
    });

    return () => {
      leafletRef.current?.remove();
    };
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        setLat(la);
        setLng(lo);
        markerRef.current?.setLatLng([la, lo]);
        leafletRef.current?.setView([la, lo], 17);
        reverseGeocode(la, lo);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-brand-500" />
          <p className="text-sm font-bold text-slate-800">Select Delivery Location</p>
        </div>
        <button onClick={onClose} type="button"
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <div ref={mapRef} className="w-full h-full" />

        {/* Locate me button */}
        <button
          type="button"
          onClick={handleLocate}
          className="absolute top-3 right-3 z-[1000] flex items-center gap-2 bg-white border border-slate-200 shadow-md rounded-xl px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
        >
          <Locate className={`w-4 h-4 ${locating ? 'animate-spin' : ''}`} />
          {locating ? 'Locating…' : 'My Location'}
        </button>

        {/* Instruction */}
        <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm rounded-xl px-3 py-2">
          <p className="text-xs text-slate-600 font-medium">Tap map or drag pin</p>
        </div>
      </div>

      {/* Address bar + confirm */}
      <div className="shrink-0 bg-white border-t border-slate-100 p-4 space-y-3">
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <MapPin className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 font-medium mb-0.5">Selected Address</p>
            <p className="text-sm text-slate-700 leading-snug">
              {loading ? 'Getting address…' : address}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onConfirm(address, lat, lng)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-600 text-white font-semibold text-sm rounded-2xl hover:bg-brand-700 disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          <Check className="w-4 h-4" />
          Confirm Location
        </button>
      </div>
    </div>
  );
};
