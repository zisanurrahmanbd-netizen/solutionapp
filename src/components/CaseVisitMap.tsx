import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CheckIn, CaseFile } from '../types';

interface CaseVisitMapProps {
  checkIns: CheckIn[];
  caseItem: CaseFile;
}

export const CaseVisitMap: React.FC<CaseVisitMapProps> = ({ checkIns, caseItem }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        attributionControl: false,
        zoomControl: true,
      }).setView([23.8103, 90.4125], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    if (checkIns.length > 0) {
      const bounds = L.latLngBounds([]);

      checkIns.forEach((ci) => {
        const isPresent = ci.address_type === 'present';
        const color = isPresent ? '#10b981' : '#a855f7';

        const customIcon = L.divIcon({
          className: 'custom-pinpoint-marker',
          html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">
                  <i class="fa-solid fa-location-dot"></i>
                </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const addressText = isPresent
          ? (caseItem?.customer_address_present || 'Present Residence')
          : (caseItem?.customer_address_permanent || 'Permanent Origin');

        const marker = L.marker([ci.latitude, ci.longitude], { icon: customIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4; padding: 4px;">
            <div style="font-weight: bold; color: ${color}; text-transform: uppercase; font-size: 10px; margin-bottom: 2px;">
              📍 Verified ${ci.address_type} Address Visit
            </div>
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              ${addressText}
            </div>
            <div style="color: #64748b; font-size: 10px;">
              <b>Agent:</b> ${ci.agent?.name || 'Field Agent'} (${ci.agent?.employee_id || 'AGT'})<br/>
              <b>Timestamp:</b> ${new Date(ci.visited_at).toLocaleString()}<br/>
              <b>GPS:</b> ${ci.latitude.toFixed(6)}, ${ci.longitude.toFixed(6)} (±${ci.accuracy || 8}m)
            </div>
            ${ci.notes ? `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; color: #334155;"><b>Outcome:</b> ${ci.notes}</div>` : ''}
          </div>
        `);

        bounds.extend([ci.latitude, ci.longitude]);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    } else {
      map.setView([23.8103, 90.4125], 11);
    }
  }, [checkIns, caseItem]);

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner h-64 relative isolate z-0 bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};