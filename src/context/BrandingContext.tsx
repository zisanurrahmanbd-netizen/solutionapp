import React, { createContext, useContext, useState, useEffect } from 'react';
import { offlineQueue } from '../services/offlineQueue';

export interface BrandingConfig {
  headerText: string;
  underText: string;
  loginTitle: string;
  loginSubtitle: string;
  logoIcon: string;
  customLogoUrl: string;
  brandColor: 'emerald' | 'blue' | 'purple' | 'indigo' | 'amber';
}

export const DEFAULT_BRANDING: BrandingConfig = {
  headerText: 'RecoveryCORE',
  underText: 'Debt Recovery Platform',
  loginTitle: 'RecoveryCORE',
  loginSubtitle: 'Multi-Bank Loan & Credit Card Recovery Tracking System',
  logoIcon: 'fa-vault',
  customLogoUrl: '',
  brandColor: 'emerald',
};

const BRANDING_STORAGE_KEY = 'app_branding_config';
export const BRANDING_CLOUD_KEY = '__branding__';

interface BrandingContextType {
  branding: BrandingConfig;
  updateBranding: (config: Partial<BrandingConfig>) => void;
  resetBranding: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

/** Registered by the provider; called by dataService when the cloud copy of the
 *  branding (logo + texts) arrives during sync so EVERY device shows the same
 *  logo and titles. */
let applyRemoteBranding: ((def: any) => boolean) | null = null;

export function applyCloudBranding(def: any): boolean {
  if (!applyRemoteBranding) return false;
  return applyRemoteBranding(def);
}

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingConfig>(() => {
    const saved = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_BRANDING, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_BRANDING;
      }
    }
    return DEFAULT_BRANDING;
  });

  useEffect(() => {
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
    document.title = `${branding.headerText} - ${branding.underText}`;
  }, [branding]);

  // Register the remote-applier once on mount
  useEffect(() => {
    applyRemoteBranding = (def: any) => {
      try {
        const remote = typeof def === 'string' ? JSON.parse(def) : def;
        if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return false;
        const merged = { ...DEFAULT_BRANDING, ...remote } as BrandingConfig;
        let changed = false;
        setBranding(prev => {
          if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
          changed = true;
          return merged;
        });
        return changed;
      } catch (_) {
        return false;
      }
    };
    return () => { applyRemoteBranding = null; };
  }, []);

  const updateBranding = (config: Partial<BrandingConfig>) => {
    setBranding(prev => ({ ...prev, ...config }));
    // Push the new branding to Supabase so ALL devices (web + APK) pick it up
    try {
      offlineQueue.runBackground({
        kind: 'upsert',
        table: 'file_templates',
        rows: [{ template_key: BRANDING_CLOUD_KEY, definition: { ...branding, ...config }, updated_at: new Date().toISOString() }],
        onConflict: 'template_key',
      });
    } catch (_) {}
  };

  const resetBranding = () => {
    setBranding(DEFAULT_BRANDING);
    localStorage.removeItem(BRANDING_STORAGE_KEY);
    // Propagate the reset to every device too (explicit admin action)
    try {
      offlineQueue.runBackground({
        kind: 'upsert',
        table: 'file_templates',
        rows: [{ template_key: BRANDING_CLOUD_KEY, definition: DEFAULT_BRANDING, updated_at: new Date().toISOString() }],
        onConflict: 'template_key',
      });
    } catch (_) {}
  };

  return (
    <BrandingContext.Provider value={{ branding, updateBranding, resetBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding must be used within BrandingProvider');
  return context;
};