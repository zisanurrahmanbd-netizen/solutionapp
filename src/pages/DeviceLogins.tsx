import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  getAllLoginSessions, 
  revokeSession, 
  LoginSession 
} from '../services/sessionService';
import { 
  Smartphone, 
  Laptop, 
  Tablet, 
  MapPin, 
  Globe, 
  RefreshCw, 
  ShieldCheck, 
  Search, 
  LogOut, 
  ExternalLink,
  CheckCircle2,
  Clock,
  Radio
} from 'lucide-react';

export const DeviceLoginsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const currentDeviceId = localStorage.getItem('recovery_device_session_id');

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getAllLoginSessions();
      setSessions(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, []);

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke session and log out device for "${name}"?`)) return;
    setRevokingId(id);
    try {
      await revokeSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } finally {
      setRevokingId(null);
    }
  };

  const filteredSessions = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sessions.filter(s => {
      if (typeFilter !== 'all' && s.device_type !== typeFilter) return false;
      if (roleFilter !== 'all' && s.user_role !== roleFilter) return false;
      if (!q) return true;
      return (
        s.user_name.toLowerCase().includes(q) ||
        s.user_email.toLowerCase().includes(q) ||
        s.device_name.toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.country || '').toLowerCase().includes(q) ||
        (s.ip || '').toLowerCase().includes(q)
      );
    });
  }, [sessions, search, typeFilter, roleFilter]);

  const activeOnlineCount = useMemo(() => sessions.filter(s => s.is_online).length, [sessions]);
  const mobileCount = useMemo(() => sessions.filter(s => s.device_type === 'mobile').length, [sessions]);
  const desktopCount = useMemo(() => sessions.filter(s => s.device_type === 'desktop').length, [sessions]);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-emerald-500" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-amber-500" />;
      default:
        return <Laptop className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Logged-in Devices & Activity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time audit of accounts, devices, operating systems, and login locations.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSessions}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 transition-all w-fit shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Now</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Active Online</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">{activeOnlineCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Laptop className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Desktops / Laptops</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">{desktopCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Mobile Devices</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">{mobileCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Total Sessions</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">{sessions.length}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search account, email, device, city, IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
          >
            <option value="all">All Device Types</option>
            <option value="desktop">💻 Desktop / Laptop</option>
            <option value="mobile">📱 Mobile Phone</option>
            <option value="tablet">📟 Tablet</option>
          </select>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="agent">Agent</option>
          </select>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Account / User</th>
                <th className="py-3 px-4">Device & OS</th>
                <th className="py-3 px-4">Login Location & IP</th>
                <th className="py-3 px-4">Status & Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No active login sessions found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredSessions.map(s => {
                  const isCurrentDevice = s.id === currentDeviceId;
                  const mapsUrl = s.latitude && s.longitude ? `https://www.google.com/maps?q=${s.latitude},${s.longitude}` : null;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Account Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                            {s.user_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{s.user_name}</span>
                              {isCurrentDevice && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                                  This Device
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{s.user_email}</div>
                            <span className={`inline-block mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              s.user_role === 'admin' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                              s.user_role === 'manager' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {s.user_role}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Device & OS */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(s.device_type)}
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {s.device_name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {s.os} • {s.browser}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Location & IP */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                            <span>{s.city ? `${s.city}, ${s.country || ''}` : 'Location detected via IP'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>IP: <span className="font-mono text-slate-600 dark:text-slate-300">{s.ip}</span></span>
                            {mapsUrl && (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-bold"
                              >
                                View Map <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Activity & Status */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${s.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                            <span className={`font-bold text-[11px] ${s.is_online ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {s.is_online ? 'Online Now' : 'Offline'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Logged in: {new Date(s.login_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleRevoke(s.id, `${s.user_name} (${s.device_name})`)}
                            disabled={revokingId === s.id}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[11px] inline-flex items-center gap-1 transition-all border border-rose-500/20"
                            title="Remotely terminate this login session"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>{revokingId === s.id ? 'Revoking...' : 'Sign Out Device'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
