import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { User, UserRole } from '../types';
import { 
  MapPin, Users, Phone, Navigation, RefreshCw, 
  Shield, UserCheck, Briefcase, Search, Radio, Crosshair, Crown, EyeOff
} from 'lucide-react';
import L from 'leaflet';
import { trackingService, LocationPing } from '../services/hrService';

export const TrackingMap: React.FC = () => {
  const { user: currentUser, users, updateUserLocation } = useAuth();
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [onlineOnly, setOnlineOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  // 24/7 trail: user_id → today's GPS breadcrumbs
  const [trails, setTrails] = useState<Record<number, LocationPing[]>>({});
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const polylinesRef = useRef<L.Polyline[]>([]);

  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';

  // Strict Scoped Telemetry Filtering based on User Hierarchy
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // ── MANAGER RESTRICTION ────────────────────────────────────────────────
      // Managers CANNOT see Admin location, other managers, or their own pin.
      // Managers CAN ONLY see Field Agents that are assigned to them.
      if (isManager) {
        if (u.role !== 'agent') return false; // Block all admins & managers
        // Must be an agent reporting to this manager
        const isAssigned = (u.manager_id && u.manager_id === currentUser.id) ||
                           (u.manager_name && currentUser.name && u.manager_name.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                           (!u.manager_id); // allow newly created unassigned agents
        if (!isAssigned) return false;
      }

      // ── FIELD AGENT RESTRICTION ────────────────────────────────────────────
      // Field agents cannot spy on other agents, managers, or admins
      if (currentUser?.role === 'agent') {
        if (u.id !== currentUser.id) return false;
      }

      // ── FILTERS (Admin view) ───────────────────────────────────────────────
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesOnline = !onlineOnly || u.is_online !== false;
      const matchesSearch = !searchQuery || 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.phone && u.phone.includes(searchQuery)) ||
        (u.employee_id && u.employee_id.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesRole && matchesOnline && matchesSearch;
    });
  }, [users, currentUser, isManager, roleFilter, onlineOnly, searchQuery]);

  // Force fresh GPS ping from current user browser
  const refreshLocation = () => {
    setIsRefreshing(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateUserLocation(pos.coords.latitude, pos.coords.longitude);
          setIsRefreshing(false);
        },
        () => {
          setIsRefreshing(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Center map on first assigned agent (for manager) or current position (for admin)
  const locateMe = () => {
    if (isAdmin && currentUser?.last_latitude && currentUser?.last_longitude && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([currentUser.last_latitude, currentUser.last_longitude], 15);
    } else if (filteredUsers.length > 0 && mapInstanceRef.current) {
      const target = filteredUsers[0];
      if (target.last_latitude && target.last_longitude) {
        mapInstanceRef.current.flyTo([target.last_latitude, target.last_longitude], 14);
      }
    } else {
      refreshLocation();
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultLat = (isManager && filteredUsers[0]?.last_latitude) || currentUser?.last_latitude || 23.8103;
      const defaultLng = (isManager && filteredUsers[0]?.last_longitude) || currentUser?.last_longitude || 90.4125;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView([defaultLat, defaultLng], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }
  }, [currentUser, isManager]);

  // Update Markers when filtered users change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear stale markers
    Object.keys(markersRef.current).forEach(idStr => {
      const id = Number(idStr);
      if (!filteredUsers.some(u => u.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Render / update markers for permitted personnel
    filteredUsers.forEach(u => {
      const lat = u.last_latitude || (23.75 + (u.id % 10) * 0.015);
      const lng = u.last_longitude || (90.38 + (u.id % 10) * 0.012);
      const isOnline = u.is_online !== false;

      let roleColor = '#10b981';
      let roleTitle = 'Field Agent';

      if (u.role === 'admin') {
        roleColor = '#9333ea';
        roleTitle = 'Administrator';
      } else if (u.role === 'manager') {
        roleColor = '#2563eb';
        roleTitle = 'Team Manager';
      }

      const pulseAnimation = isOnline ? 'box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.25);' : '';

      const icon = L.divIcon({
        className: 'custom-staff-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background-color: ${roleColor};
            color: white;
            border-radius: 50%;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 14px rgba(0,0,0,0.3);
            font-weight: 900;
            font-size: 11px;
            font-family: sans-serif;
            ${pulseAnimation}
          ">
            ${u.name.charAt(0)}
            <span style="
              position: absolute;
              bottom: -2px;
              right: -2px;
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background-color: ${isOnline ? '#10b981' : '#94a3b8'};
              border: 2px solid #ffffff;
            "></span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 180px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <strong style="font-size: 13px; color: #0f172a;">${u.name}</strong>
            <span style="font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 2px 6px; border-radius: 6px; background-color: ${roleColor}15; color: ${roleColor};">
              ${roleTitle}
            </span>
          </div>
          <div style="font-size: 11px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
            <div><b>ID:</b> ${u.employee_id || 'N/A'}</div>
            <div><b>Phone:</b> ${u.phone ? `<a href="tel:${u.phone}" style="color: #2563eb; text-decoration: none;">${u.phone}</a>` : 'N/A'}</div>
            <div><b>Email:</b> ${u.email}</div>
            ${u.manager_name ? `<div><b>Manager:</b> ${u.manager_name}</div>` : ''}
            <div><b>Status:</b> <span style="color: ${isOnline ? '#059669' : '#64748b'}; font-weight: bold;">${isOnline ? '● Active Live GPS' : '○ Offline'}</span></div>
            <div style="margin-top: 4px; font-family: monospace; font-size: 10px; color: #94a3b8;">
              ${lat.toFixed(5)}, ${lng.toFixed(5)}
            </div>
          </div>
        </div>
      `;

      if (markersRef.current[u.id]) {
        markersRef.current[u.id].setLatLng([lat, lng]);
        markersRef.current[u.id].setIcon(icon);
        markersRef.current[u.id].setPopupContent(popupHtml);
      } else {
        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(popupHtml);
        markersRef.current[u.id] = marker;
      }
    });
  }, [filteredUsers]);

  // ── 24/7 trail loader: refresh every 60s for currently visible users ──
  useEffect(() => {
    if (!showTrails) return;
    let cancelled = false;
    const loadTrails = async () => {
      try {
        const ids = filteredUsers.map(u => u.id);
        if (ids.length === 0) return;
        const results = await Promise.all(
          ids.map(async id => [id, await trackingService.fetchPings(id)] as const)
        );
        if (!cancelled) setTrails(Object.fromEntries(results));
      } catch (_) {}
    };
    loadTrails();
    const t = setInterval(loadTrails, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [filteredUsers.map(u => u.id).join(','), showTrails]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render 24/7 trails (polylines) under the markers ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];
    if (!showTrails) return;

    filteredUsers.forEach(u => {
      const pings = trails[u.id];
      if (!pings || pings.length < 2) return;
      const points: [number, number][] = pings
        .filter(p => p.latitude && p.longitude)
        .map(p => [p.latitude, p.longitude]);
      if (points.length < 2) return;

      const isAgent = u.role === 'agent';
      const lineColor = u.role === 'admin' ? '#9333ea' : u.role === 'manager' ? '#2563eb' : '#10b981';

      const trail = L.polyline(points, {
        color: lineColor,
        weight: isAgent ? 3 : 2,
        opacity: 0.55,
        dashArray: '6 6',
      }).addTo(map);

      trail.bindTooltip(
        `<b>${u.name}</b> — 24/7 trail today (${points.length} GPS points)`,
        { sticky: true }
      );
      polylinesRef.current.push(trail);
    });
  }, [trails, filteredUsers, showTrails]);

  const focusUser = (lat?: number | null, lng?: number | null) => {
    const targetLat = lat || 23.8103;
    const targetLng = lng || 90.4125;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([targetLat, targetLng], 15, { duration: 1.2 });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header with Title & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isManager 
                ? 'Assigned Field Agent Telemetry'
                : t('map.title', 'Live Personnel & Field Telemetry')}
            </h2>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Real-Time GPS</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isManager
              ? 'Real-time GPS locations of active field recovery agents reporting directly to you.'
              : 'Track real-time GPS locations of all personnel across the recovery system.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Locate Me / Focus button */}
          {isAdmin && (
            <button
              onClick={locateMe}
              title="Center map on my live coordinates"
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Crosshair className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">My Location</span>
            </button>
          )}

          {/* 24/7 Trail toggle */}
          <button
            onClick={() => setShowTrails(v => !v)}
            title="Show/hide today's GPS movement trails"
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              showTrails
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${showTrails ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">24/7 Trail</span>
          </button>

          {/* Refresh GPS button */}
          <button
            onClick={refreshLocation}
            className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-700 flex items-center gap-2 transition-all border border-slate-700/50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Main Map & Filter Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left Column: Personnel List & Filters */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* Header & Total Count */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span>{isManager ? 'Assigned Field Agents' : 'Personnel Directory'}</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {filteredUsers.length} {isManager ? 'agents' : 'staff'}
              </span>
            </div>

            {/* Quick Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agent name, phone, ID..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* Role Filter Tabs (Visible to Super Admin only) */}
            {isAdmin && (
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all ${
                    roleFilter === 'all'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All Staff ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('manager')}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    roleFilter === 'manager'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                  }`}
                >
                  <Briefcase className="w-3 h-3" />
                  <span>Managers ({users.filter(u => u.role === 'manager').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('agent')}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    roleFilter === 'agent'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Agents ({users.filter(u => u.role === 'agent').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('admin')}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    roleFilter === 'admin'
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                      : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                  }`}
                >
                  <Crown className="w-3 h-3" />
                  <span>Admins ({users.filter(u => u.role === 'admin').length})</span>
                </button>
              </div>
            )}

            {/* Personnel Scroll List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredUsers.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400">
                  <EyeOff className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-semibold">{isManager ? 'No agents assigned to you yet' : 'No staff members found'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{isManager ? 'Field agents assigned to your team will appear here.' : 'Add agents in Team Management.'}</p>
                </div>
              )}
              {filteredUsers.map(u => {
                const isOnline = u.is_online !== false;
                const isMe = u.id === currentUser?.id;

                let roleBadgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                let roleIcon = <UserCheck className="w-3 h-3" />;
                if (u.role === 'admin') {
                  roleBadgeColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
                  roleIcon = <Crown className="w-3 h-3" />;
                } else if (u.role === 'manager') {
                  roleBadgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
                  roleIcon = <Briefcase className="w-3 h-3" />;
                }

                return (
                  <div
                    key={u.id}
                    onClick={() => focusUser(u.last_latitude, u.last_longitude)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all text-xs space-y-1.5 ${
                      isMe 
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{u.name}</span>
                        {isMe && (
                          <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded bg-blue-600 text-white">
                            You
                          </span>
                        )}
                      </div>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[10px] font-bold uppercase ${roleBadgeColor}`}>
                        {roleIcon}
                        <span>{u.role}</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{u.employee_id || 'STAFF'}</span>
                    </div>

                    {u.phone && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                        <Phone className="w-2.5 h-2.5" />
                        <span>{u.phone}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Role Map Legend at Bottom */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1.5">
            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Map Legend</span>
            <div className="flex items-center gap-3 text-[10px] flex-wrap">
              {isAdmin && (
                <>
                  <span className="flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> Admin
                  </span>
                  <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Manager
                  </span>
                </>
              )}
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Assigned Agent
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Full Leaflet Map View */}
        <div className="lg:col-span-3 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-900 min-h-[580px] relative isolate z-0">
          <div ref={mapContainerRef} className="w-full h-full min-h-[580px]" />
        </div>
      </div>
    </div>
  );
};