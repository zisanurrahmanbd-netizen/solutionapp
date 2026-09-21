import { supabase } from '../lib/supabase';
import { User } from '../types';

export interface LoginSession {
  id: string; // unique device session id
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  device_name: string;
  device_type: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
  user_agent: string;
  ip?: string;
  city?: string;
  country?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  login_at: string;
  last_active_at: string;
  is_online: boolean;
}

// ── 1. Detect Device, Browser and OS ──────────────────────────────────────────
export function detectDeviceInfo(): {
  device_name: string;
  device_type: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
  user_agent: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  // Detect OS
  let os = 'Unknown OS';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Detect Browser
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';

  // Detect Device Type
  let device_type: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device_type = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) {
    device_type = 'mobile';
  }

  const device_name = `${os} • ${browser}`;
  return { device_name, device_type, browser, os, user_agent: ua };
}

// ── 2. Detect Geolocation & IP ────────────────────────────────────────────────
export async function detectLocation(): Promise<{
  ip?: string;
  city?: string;
  country?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}> {
  let locationData: {
    ip?: string;
    city?: string;
    country?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
  } = {};

  // 1. IP Geolocation (no prompt required, instantaneous)
  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) {
        locationData = {
          ip: data.ip,
          city: data.city,
          country: data.country_name || data.country,
          region: data.region,
          latitude: data.latitude,
          longitude: data.longitude,
        };
      }
    }
  } catch (_) {
    try {
      const res2 = await fetch('https://ipwho.is/', { cache: 'no-store' });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.success) {
          locationData = {
            ip: data2.ip,
            city: data2.city,
            country: data2.country,
            region: data2.region,
            latitude: data2.latitude,
            longitude: data2.longitude,
          };
        }
      }
    } catch (_) {}
  }

  // 2. High-precision GPS Geolocation if already permitted
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          p => resolve(p),
          () => resolve(null),
          { timeout: 4000, maximumAge: 60000 }
        );
      });
      if (pos && pos.coords) {
        locationData.latitude = pos.coords.latitude;
        locationData.longitude = pos.coords.longitude;
      }
    } catch (_) {}
  }

  return locationData;
}

// ── 3. Record or Update Device Login Session ──────────────────────────────────
export async function recordLoginSession(user: User): Promise<LoginSession> {
  const device = detectDeviceInfo();
  let session_id = localStorage.getItem('recovery_device_session_id');
  if (!session_id) {
    session_id = `dev_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem('recovery_device_session_id', session_id);
  }

  const loc = await detectLocation();
  const now = new Date().toISOString();

  const newSession: LoginSession = {
    id: session_id,
    user_id: user.id,
    user_name: user.name,
    user_email: user.email.toLowerCase(),
    user_role: user.role,
    device_name: device.device_name,
    device_type: device.device_type,
    browser: device.browser,
    os: device.os,
    user_agent: device.user_agent,
    ip: loc.ip || '—',
    city: loc.city || 'Dhaka',
    country: loc.country || 'Bangladesh',
    region: loc.region,
    latitude: loc.latitude,
    longitude: loc.longitude,
    login_at: now,
    last_active_at: now,
    is_online: true,
  };

  // Sync to users table for live agent tracking map
  if (loc.latitude && loc.longitude) {
    try {
      supabase.from('users').update({
        last_latitude: loc.latitude,
        last_longitude: loc.longitude,
        last_ping_at: now,
        is_online: true,
      }).eq('id', user.id).then();
    } catch (_) {}
  }

  // Upsert session to cloud active_user_sessions registry
  try {
    const { data } = await supabase.from('file_templates').select('definition').eq('template_key', 'active_user_sessions').maybeSingle();
    let currentSessions: LoginSession[] = [];
    if (data?.definition) {
      currentSessions = typeof data.definition === 'string' ? JSON.parse(data.definition) : data.definition;
      if (!Array.isArray(currentSessions)) currentSessions = [];
    }

    const updated = [newSession, ...currentSessions.filter(s => s.id !== session_id)].slice(0, 100);

    await supabase.from('file_templates').upsert({
      template_key: 'active_user_sessions',
      definition: JSON.stringify(updated),
      updated_at: now,
    }, { onConflict: 'template_key' });
  } catch (err) {
    console.warn('Error recording session in cloud:', err);
  }

  return newSession;
}

// ── 4. Keep-Alive Ping ────────────────────────────────────────────────────────
export async function pingSession(user: User): Promise<void> {
  const session_id = localStorage.getItem('recovery_device_session_id');
  if (!session_id) return;
  const now = new Date().toISOString();

  try {
    const { data } = await supabase.from('file_templates').select('definition').eq('template_key', 'active_user_sessions').maybeSingle();
    if (data?.definition) {
      let sessions: LoginSession[] = typeof data.definition === 'string' ? JSON.parse(data.definition) : data.definition;
      if (Array.isArray(sessions)) {
        let changed = false;
        sessions = sessions.map(s => {
          if (s.id === session_id) {
            changed = true;
            return { ...s, last_active_at: now, is_online: true };
          }
          // Mark as offline if inactive for > 5 mins
          const lastActive = new Date(s.last_active_at).getTime();
          if (Date.now() - lastActive > 5 * 60 * 1000 && s.is_online) {
            changed = true;
            return { ...s, is_online: false };
          }
          return s;
        });

        if (changed) {
          await supabase.from('file_templates').upsert({
            template_key: 'active_user_sessions',
            definition: JSON.stringify(sessions),
            updated_at: now,
          }, { onConflict: 'template_key' });
        }
      }
    }
  } catch (_) {}
}

// ── 5. Terminate Session On Logout ────────────────────────────────────────────
export async function terminateCurrentSession(): Promise<void> {
  const session_id = localStorage.getItem('recovery_device_session_id');
  if (!session_id) return;
  try {
    const { data } = await supabase.from('file_templates').select('definition').eq('template_key', 'active_user_sessions').maybeSingle();
    if (data?.definition) {
      let sessions: LoginSession[] = typeof data.definition === 'string' ? JSON.parse(data.definition) : data.definition;
      if (Array.isArray(sessions)) {
        sessions = sessions.map(s => s.id === session_id ? { ...s, is_online: false, last_active_at: new Date().toISOString() } : s);
        await supabase.from('file_templates').upsert({
          template_key: 'active_user_sessions',
          definition: JSON.stringify(sessions),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'template_key' });
      }
    }
  } catch (_) {}
}

// ── 6. Revoke / Remove Device Session ─────────────────────────────────────────
export async function revokeSession(sessionId: string): Promise<void> {
  try {
    const { data } = await supabase.from('file_templates').select('definition').eq('template_key', 'active_user_sessions').maybeSingle();
    if (data?.definition) {
      let sessions: LoginSession[] = typeof data.definition === 'string' ? JSON.parse(data.definition) : data.definition;
      if (Array.isArray(sessions)) {
        sessions = sessions.filter(s => s.id !== sessionId);
        await supabase.from('file_templates').upsert({
          template_key: 'active_user_sessions',
          definition: JSON.stringify(sessions),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'template_key' });
      }
    }
  } catch (_) {}
}

// ── 7. Get All Logged-in Device Sessions ──────────────────────────────────────
export async function getAllLoginSessions(): Promise<LoginSession[]> {
  try {
    const { data } = await supabase.from('file_templates').select('definition').eq('template_key', 'active_user_sessions').maybeSingle();
    if (data?.definition) {
      const sessions: LoginSession[] = typeof data.definition === 'string' ? JSON.parse(data.definition) : data.definition;
      if (Array.isArray(sessions)) {
        return sessions.map(s => {
          const lastActive = new Date(s.last_active_at).getTime();
          const isReallyOnline = (Date.now() - lastActive) < 5 * 60 * 1000;
          return { ...s, is_online: s.is_online && isReallyOnline };
        });
      }
    }
  } catch (_) {}
  return [];
}
