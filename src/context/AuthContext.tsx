import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { recordLoginSession, pingSession, terminateCurrentSession } from '../services/sessionService';
import { offlineQueue } from '../services/offlineQueue';

// Real production admin only
export const REAL_ADMIN: User = {
  id: 1,
  name: 'Zisan Ur Rahman',
  email: 'zisanurrahmanbd@gmail.com',
  role: 'admin',
  employee_id: 'ADMIN-001',
  phone: '01608800026',
  status: 'active',
  is_online: true,
  password: '@01608800026',
};

const USERS_VERSION = '7.0_supabase_cloud_sync';

// Levenshtein edit distance — used to catch login email typos (e.g. missing 'z').
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}

function suggestEmail(typed: string, knownEmails: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const email of knownEmails) {
    if (email === typed) continue;
    // Compare full addresses, weighting the local part (before @) more heavily.
    const [tLocal] = typed.split('@');
    const [kLocal] = email.split('@');
    const d = editDistance(tLocal, kLocal) * 2 + editDistance(typed, email);
    if (d < bestDist) {
      bestDist = d;
      best = email;
    }
  }
  // Only suggest when the match is clearly a typo, not a different person.
  return best !== null && bestDist <= 6 ? best : null;
}

function getInitialUsers(): User[] {
  const version = localStorage.getItem('recovery_users_version');
  if (version !== USERS_VERSION) {
    localStorage.removeItem('recovery_all_users');
    localStorage.setItem('recovery_users_version', USERS_VERSION);
    const initial = [REAL_ADMIN];
    localStorage.setItem('recovery_all_users', JSON.stringify(initial));
    return initial;
  }
  try {
    const saved = localStorage.getItem('recovery_all_users');
    if (saved) {
      const parsed: User[] = JSON.parse(saved);
      let foundAdmin = false;
      const updated = parsed.map(u => {
        if (u.email.toLowerCase() === REAL_ADMIN.email.toLowerCase()) {
          foundAdmin = true;
          return {
            ...u,
            name: 'Zisan Ur Rahman',
            role: 'admin' as const,
            status: 'active' as const,
            password: u.password || '@01608800026',
          };
        }
        return u;
      });
      if (!foundAdmin) {
        updated.unshift(REAL_ADMIN);
      }
      localStorage.setItem('recovery_all_users', JSON.stringify(updated));
      return updated;
    }
  } catch (_) {}
  return [REAL_ADMIN];
}

interface OtpSession {
  code: string;
  email: string;
  expiresAt: number;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (email: string, pass: string) => Promise<{ result: 'ok' | 'otp_required' | 'error'; error?: string }>;
  verifyOtp: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  pendingEmail: string | null;
  generateOtp: (email: string) => string;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => Promise<User>;
  updateUser: (id: number, user: Partial<User>) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  updateUserLocation: (lat: number, lng: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(getInitialUsers);
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('recovery_auth_user');
      if (saved) {
        const parsed: User = JSON.parse(saved);
        if (parsed?.status === 'inactive') return null;
        if (parsed.email?.toLowerCase() === REAL_ADMIN.email.toLowerCase()) {
          parsed.role = 'admin';
        }
        return parsed;
      }
    } catch (_) {}
    return null;
  });

  const [otpSession, setOtpSession] = useState<OtpSession | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verifiedDevices, setVerifiedDevices] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('recovery_verified_devices');
      return new Set(JSON.parse(saved || '[]'));
    } catch (_) { return new Set(); }
  });

  // ── Sync with Supabase on Startup ──────────────────────────────────────────
  useEffect(() => {
    const mergeCloudUsers = (data: any[]) => {
      const cloudUsers: User[] = data.map((row: any) => ({
        id: Number(row.id),
        name: row.name || 'User',
        email: (row.email || '').toLowerCase(),
        phone: row.phone || '',
        employee_id: row.employee_id || '',
        role: (row.role || (row.email?.toLowerCase() === REAL_ADMIN.email ? 'admin' : 'agent')) as UserRole,
        status: row.status || 'active',
        password: row.password || (row.email?.toLowerCase() === REAL_ADMIN.email ? '@01608800026' : '@Pass2026'),
        last_latitude: row.last_latitude ? Number(row.last_latitude) : undefined,
        last_longitude: row.last_longitude ? Number(row.last_longitude) : undefined,
        last_ping_at: row.last_ping_at,
        is_online: row.is_online !== false,
      }));

      setUsers(prev => {
        const map = new Map<number, User>();
        prev.forEach(u => map.set(u.id, u));
        cloudUsers.forEach(u => map.set(u.id, { ...map.get(u.id), ...u }));
        const merged = Array.from(map.values());
        // Skip state churn when nothing actually changed — returning a new array
        // every 20s re-rendered the entire app even with zero user changes.
        const unchanged = merged.length === prev.length && merged.every((u, i) => {
          const p = prev[i];
          return p && u.id === p.id && u.name === p.name && u.role === p.role &&
            u.status === p.status && u.last_ping_at === p.last_ping_at &&
            u.last_latitude === p.last_latitude && u.last_longitude === p.last_longitude;
        });
        if (unchanged) return prev;
        localStorage.setItem('recovery_all_users', JSON.stringify(merged));
        return merged;
      });
    };

    // Don't stack user fetches when the network is slow — overlapping 20s polls
    // plus realtime events kept the CPU and network busy constantly.
    let usersFetchInFlight = false;
    const fetchCloudUsers = async () => {
      if (usersFetchInFlight) return;
      usersFetchInFlight = true;
      try {
        // Try 1: Supabase JS client
        try {
          const { data, error } = await supabase.from('users').select('*');
          if (!error && Array.isArray(data) && data.length > 0) {
            mergeCloudUsers(data);
            return; // success
          }
        } catch (err) {
          console.warn('Supabase JS client sync failed, trying REST fallback:', err);
        }
        // Try 2: Direct REST API fallback
        try {
          const SUPABASE_URL = 'https://qjcuzydfxbdhepcumale.supabase.co';
          const SUPABASE_KEY = 'sb_publishable_IBUA2iCD_p1b3rmTuC7zGg_Lk-ViIaA';
          const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Accept': 'application/json',
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              mergeCloudUsers(data);
            }
          }
        } catch (err) {
          console.warn('REST fallback cloud sync also failed:', err);
        }
      } finally {
        usersFetchInFlight = false;
      }
    };
    fetchCloudUsers();

    // Poll every 20 seconds so all open tabs and devices stay in sync
    const syncTimer = setInterval(fetchCloudUsers, 20_000);

    // Supabase Realtime channel for instant multi-device user sync
    let channel: any = null;
    try {
      channel = supabase
        .channel('public:users_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchCloudUsers();
        })
        .subscribe();
    } catch (_) {}

    return () => {
      clearInterval(syncTimer);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('recovery_all_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (user) {
      if (user.status === 'inactive') {
        setUser(null);
        localStorage.removeItem('recovery_auth_user');
      } else {
        const toSave = user.email.toLowerCase() === REAL_ADMIN.email.toLowerCase()
          ? { ...user, role: 'admin' }
          : user;
        localStorage.setItem('recovery_auth_user', JSON.stringify(toSave));
      }
    } else {
      localStorage.removeItem('recovery_auth_user');
    }
  }, [user]);

  // ── Auto-record Device Login Session & Geolocation ─────────────────────────
  useEffect(() => {
    if (!user) return;
    recordLoginSession(user);
    const pingTimer = setInterval(() => {
      pingSession(user);
    }, 30_000);
    return () => clearInterval(pingTimer);
  }, [user?.id]);

  // ── Live Session Watchdog: Force-logout deactivated users within 30s ──────
  useEffect(() => {
    if (!user) return;
    // Primary admin can never be deactivated — skip watchdog
    if (user.email.toLowerCase() === REAL_ADMIN.email.toLowerCase()) return;

    const watchdog = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, status')
          .eq('email', user.email.toLowerCase())
          .single();

        if (error) return; // network issue — keep session alive, retry next tick

        if (data?.status === 'inactive') {
          clearInterval(watchdog);
          localStorage.removeItem('recovery_auth_user');
          localStorage.removeItem('recovery_verified_devices');
          setUser(null);
          // Fire event so Login page can display a clear reason message
          window.dispatchEvent(new CustomEvent('account_deactivated', {
            detail: { message: 'Your account has been deactivated by an administrator. Please contact your manager.' }
          }));
        }
      } catch (_) {
        // Silently ignore network errors — do not terminate session on connectivity issues
      }
    }, 30_000); // Poll every 30 seconds

    return () => clearInterval(watchdog);
  }, [user]);

  const getLatestUsers = (): User[] => {
    try {
      const saved = localStorage.getItem('recovery_all_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(u => {
            if (u.email.toLowerCase() === REAL_ADMIN.email.toLowerCase()) {
              return { ...u, role: 'admin' };
            }
            return u;
          });
        }
      }
    } catch (_) {}
    return users;
  };

  const updateUserLocation = useCallback((lat: number, lng: number) => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    
    setUsers(prev => {
      const next = prev.map(u => {
        if (u.id === user.id) {
          return {
            ...u,
            last_latitude: lat,
            last_longitude: lng,
            last_ping_at: nowIso,
            is_online: true,
          };
        }
        return u;
      });
      localStorage.setItem('recovery_all_users', JSON.stringify(next));
      return next;
    });

    setUser(prev => prev ? {
      ...prev,
      last_latitude: lat,
      last_longitude: lng,
      last_ping_at: nowIso,
      is_online: true,
    } : null);

    // Sync location to Supabase
    try {
      supabase.from('users').update({
        last_latitude: lat,
        last_longitude: lng,
        last_ping_at: nowIso,
        is_online: true,
      }).eq('id', user.id).then();
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => updateUserLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => console.warn('Geolocation initial ping:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );

      const watchId = navigator.geolocation.watchPosition(
        (pos) => updateUserLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => console.warn('Geolocation watch ping:', err.message),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [user?.id, updateUserLocation]);

  const generateOtp = (email: string): string => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const session: OtpSession = {
      code,
      email: email.toLowerCase(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    setOtpSession(session);
    setPendingEmail(email.toLowerCase());
    return code;
  };

  // ── Helper: parse a Supabase row into a User object ─────────────────────
  const parseCloudUser = (data: any): User => ({
    id: Number(data.id),
    name: data.name || 'User',
    email: (data.email || '').toLowerCase(),
    phone: data.phone || '',
    employee_id: data.employee_id || '',
    role: (data.role || (data.email?.toLowerCase() === REAL_ADMIN.email ? 'admin' : 'agent')) as UserRole,
    status: data.status || 'active',
    password: data.password || '@Pass2026',
    last_latitude: data.last_latitude ? Number(data.last_latitude) : undefined,
    last_longitude: data.last_longitude ? Number(data.last_longitude) : undefined,
    last_ping_at: data.last_ping_at,
    is_online: data.is_online !== false,
  });

  // ── Direct REST API fallback when Supabase JS client fails ────────────
  const fetchUserViaRest = async (emailQuery: string): Promise<User | null> => {
    try {
      const SUPABASE_URL = 'https://qjcuzydfxbdhepcumale.supabase.co';
      const SUPABASE_KEY = 'sb_publishable_IBUA2iCD_p1b3rmTuC7zGg_Lk-ViIaA';
      const url = `${SUPABASE_URL}/rest/v1/users?select=*&email=ilike.${encodeURIComponent(emailQuery)}&limit=1`;
      const res = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return parseCloudUser(rows[0]);
        }
      }
    } catch (e) {
      console.warn('REST fallback lookup failed:', e);
    }
    return null;
  };

  // ── Multi-Device Cross-Cloud Login ─────────────────────────────────────────
  const login = async (email: string, pass: string): Promise<{ result: 'ok' | 'otp_required' | 'error'; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    let found: User | null = null;
    let cloudError: string | null = null;

    // 1. Check Supabase cloud database first for the latest email, password, and status.
    //    The JS client can fail on some networks (proxy/CDN blocks the realtime edge), so
    //    every failure MUST fall through to the direct REST lookup before giving up.
    try {
      const { data, error } = await supabase.from('users').select('*').ilike('email', cleanEmail).maybeSingle();
      if (!error && data) {
        found = parseCloudUser(data);
      } else if (error) {
        cloudError = error.message;
      }
    } catch (err: any) {
      cloudError = err?.message || String(err);
    }

    // 2. Fallback: Direct REST API lookup (also retries the JS lookup once)
    if (!found) {
      const restUser = await fetchUserViaRest(cleanEmail);
      if (restUser) {
        found = restUser;
        cloudError = null;
      }
    }

    // 3. Retry the JS client once — transient failures on first call are common
    if (!found) {
      try {
        const { data, error } = await supabase.from('users').select('*').ilike('email', cleanEmail).maybeSingle();
        if (!error && data) {
          found = parseCloudUser(data);
          cloudError = null;
        }
      } catch (_) {}
    }

    // 4. Fallback: Local cached users (e.g. offline mode)
    if (!found) {
      const list = getLatestUsers();
      const localFound = list.find(u => u.email.toLowerCase() === cleanEmail);
      if (localFound) {
        found = localFound;
        cloudError = null;
      }
    }

    // Update local cache with latest user data
    if (found) {
      setUsers(prev => {
        const next = [found!, ...prev.filter(u => u.id !== found!.id && u.email.toLowerCase() !== cleanEmail)];
        localStorage.setItem('recovery_all_users', JSON.stringify(next));
        return next;
      });
    }

    if (!found) {
      // If there was a cloud error, tell the user it might be a network issue
      if (cloudError) {
        return { result: 'error', error: `Could not verify your account from the cloud database (${cloudError}). Please check your internet connection and try again.` };
      }
      // Typo detection: suggest the closest known email (handles missing/extra letters)
      const suggestion = suggestEmail(cleanEmail, getLatestUsers().map(u => u.email));
      return { result: 'error', error: suggestion
        ? `No account found for "${cleanEmail}". Did you mean ${suggestion}?`
        : 'No account found with this email address. Please ensure this user has been added in Team Management.' };
    }
    if (found.status === 'inactive') {
      return { result: 'error', error: 'This account has been deactivated by the Administrator.' };
    }

    const correctPassword = found.password || '';
    if (!correctPassword) {
      return { result: 'error', error: 'Account password not configured. Contact Administrator.' };
    }
    if (pass !== correctPassword) {
      return { result: 'error', error: 'Incorrect password. Please try again.' };
    }

    if (found.email.toLowerCase() === REAL_ADMIN.email.toLowerCase()) {
      found.role = 'admin';
    }

    const deviceKey = `${found.email}:${navigator.userAgent.slice(0, 60)}`;
    if (!verifiedDevices.has(deviceKey)) {
      setPendingEmail(found.email.toLowerCase());
      return { result: 'otp_required' };
    }

    setUser(found);
    return { result: 'ok' };
  };

  const verifyOtp = async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
    const cleanCode = code.trim();
    let isMatch = false;

    if (otpSession && otpSession.email === email.toLowerCase() && Date.now() <= otpSession.expiresAt) {
      if (cleanCode === otpSession.code) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.toLowerCase(),
          token: cleanCode,
          type: 'email',
        });
        if (data?.user && !error) {
          isMatch = true;
        }
      } catch (err) {
        console.warn('Supabase verifyOtp note:', err);
      }
    }

    if (!isMatch) {
      return { success: false, error: 'Invalid or expired 6-digit verification code. Please check your Gmail and try again.' };
    }

    const list = getLatestUsers();
    const found = list.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) return { success: false, error: 'User account not found.' };

    if (found.email.toLowerCase() === REAL_ADMIN.email.toLowerCase()) {
      found.role = 'admin';
    }

    const deviceKey = `${found.email}:${navigator.userAgent.slice(0, 60)}`;
    const newVerified = new Set(verifiedDevices);
    newVerified.add(deviceKey);
    setVerifiedDevices(newVerified);
    localStorage.setItem('recovery_verified_devices', JSON.stringify(Array.from(newVerified)));

    setOtpSession(null);
    setPendingEmail(null);
    setUser(found);
    return { success: true };
  };

  const logout = () => {
    terminateCurrentSession();
    if (user) {
      setUsers(prev => {
        const next = prev.map(u => u.id === user.id ? { ...u, is_online: false } : u);
        localStorage.setItem('recovery_all_users', JSON.stringify(next));
        return next;
      });
      try {
        supabase.from('users').update({ is_online: false }).eq('id', user.id).then();
      } catch (_) {}
    }
    setUser(null);
    setPendingEmail(null);
    setOtpSession(null);
  };

  const SUPABASE_URL = 'https://qjcuzydfxbdhepcumale.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_IBUA2iCD_p1b3rmTuC7zGg_Lk-ViIaA';

  // ── Multi-Device Add User ───────────────────────────────────────────────────
  // Routes through the offline queue: if the device is offline, the create is
  // persisted and replayed the moment connectivity returns — it can never be lost.
  const addUser = async (newUser: Omit<User, 'id'>): Promise<User> => {
    const emailTaken = getLatestUsers().some(u => u.email.toLowerCase() === newUser.email.trim().toLowerCase());
    if (emailTaken) {
      throw new Error('A user with this email already exists. Try signing in instead.');
    }

    const created: User = {
      ...newUser,
      id: Date.now(),
      email: newUser.email.trim().toLowerCase(),
      status: newUser.status || 'active',
      is_online: false,
    };

    const row = {
      id: created.id,
      name: created.name,
      email: created.email,
      phone: created.phone || '',
      employee_id: created.employee_id || '',
      manager_id: (created as any).manager_id ?? null,
      manager_name: (created as any).manager_name ?? null,
      role: created.role,
      status: created.status,
      password: created.password || '@Pass2026',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = await offlineQueue.run({ kind: 'upsert', table: 'users', rows: [row], onConflict: 'email' });
    if (res.error) {
      throw new Error(`Failed to save user to cloud database: ${res.error}`);
    }

    setUsers(prev => {
      const next = [created, ...prev.filter(u => u.email.toLowerCase() !== created.email.toLowerCase())];
      localStorage.setItem('recovery_all_users', JSON.stringify(next));
      return next;
    });

    return created;
  };

  // ── Multi-Device Update User ────────────────────────────────────────────────
  const updateUser = async (id: number, updated: Partial<User>): Promise<void> => {
    const cleanUpdated: Partial<User> = { ...updated };
    if (cleanUpdated.email) {
      cleanUpdated.email = cleanUpdated.email.trim().toLowerCase();
    }

    // Build the DB payload from defined fields only — undefined values must never
    // reach the cloud (a `{ password: undefined }` patch used to wipe stored passwords,
    // which then made the account un-loginable from every device).
    const dbPayload: Record<string, any> = {};
    Object.entries(cleanUpdated).forEach(([k, v]) => {
      if (v !== undefined) dbPayload[k] = v;
    });
    dbPayload.updated_at = new Date().toISOString();

    const res = await offlineQueue.run({ kind: 'update', table: 'users', row: dbPayload, matchCol: 'id', matchVal: id });
    if (res.error) {
      throw new Error(`Failed to update user in cloud database: ${res.error}`);
    }

    setUsers(prev => {
      const next = prev.map(u => {
        if (u.id === id) {
          if (u.email.toLowerCase() === REAL_ADMIN.email.toLowerCase()) {
            return { ...u, ...cleanUpdated, role: 'admin' as const };
          }
          return { ...u, ...cleanUpdated };
        }
        return u;
      });
      localStorage.setItem('recovery_all_users', JSON.stringify(next));
      return next;
    });

    if (user && user.id === id) {
      if (cleanUpdated.status === 'inactive') {
        setUser(null);
        localStorage.removeItem('recovery_auth_user');
      } else {
        const updatedRole = (user.email.toLowerCase() === REAL_ADMIN.email.toLowerCase())
          ? 'admin'
          : (cleanUpdated.role || user.role);
        setUser(prev => prev ? { ...prev, ...cleanUpdated, role: updatedRole } : null);
      }
    }
  };

  // ── Multi-Device Delete User ────────────────────────────────────────────────
  const deleteUser = async (id: number): Promise<void> => {
    const res = await offlineQueue.run({ kind: 'delete', table: 'users', matchCol: 'id', matchVals: [id] });
    if (res.error) {
      throw new Error(`Failed to delete user from cloud database: ${res.error}`);
    }

    setUsers(prev => {
      const next = prev.filter(u => {
        if (u.email.toLowerCase() === REAL_ADMIN.email.toLowerCase()) return true;
        return u.id !== id;
      });
      localStorage.setItem('recovery_all_users', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{
      user, users,
      login, verifyOtp, pendingEmail, generateOtp,
      logout,
      addUser, updateUser, deleteUser,
      updateUserLocation
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};