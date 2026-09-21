import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, User } from '../types';
import { useAuth } from './AuthContext';

export interface AppPermissions {
  // Navigation Modules
  view_dashboard: boolean;
  view_powerbi: boolean;
  view_cash_collected: boolean;
  view_cases: boolean;
  view_map: boolean;
  view_workhub: boolean;
  view_imports: boolean;
  view_contacts: boolean;
  view_reports_perf: boolean;
  view_reports_expiry: boolean;
  view_reports_legal: boolean;
  view_team: boolean;
  view_device_logins: boolean;

  // Actions & Operations
  edit_case_details: boolean;
  reassign_case: boolean;
  gps_checkin: boolean;
  record_payment: boolean;
  log_remark: boolean;
  export_excel: boolean;
  export_xlsx: boolean;
  send_bulk_messages: boolean;
  manage_contacts: boolean;
  manage_team_users: boolean;
  manage_branding: boolean;
}

export type PermissionKey = keyof AppPermissions;

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, AppPermissions> = {
  admin: {
    view_dashboard: true,
    view_powerbi: true,
    view_cash_collected: true,
    view_cases: true,
    view_map: true,
    view_workhub: true,
    view_imports: true,
    view_contacts: true,
    view_reports_perf: true,
    view_reports_expiry: true,
    view_reports_legal: true,
    view_team: true,
    view_device_logins: true,
    edit_case_details: true,
    reassign_case: true,
    gps_checkin: true,
    record_payment: true,
    log_remark: true,
    export_excel: true,
    export_xlsx: true,
    send_bulk_messages: true,
    manage_contacts: true,
    manage_team_users: true,
    manage_branding: true,
  },
  manager: {
    view_dashboard: true,
    view_powerbi: true,
    view_cash_collected: true,
    view_cases: true,
    view_map: true,
    view_workhub: true,
    view_imports: false,
    view_contacts: true,
    view_reports_perf: true,
    view_reports_expiry: true,
    view_reports_legal: true,
    view_team: false,
    view_device_logins: false,
    edit_case_details: true,
    reassign_case: true,
    gps_checkin: true,
    record_payment: true,
    log_remark: true,
    export_excel: true,
    export_xlsx: true,
    send_bulk_messages: true,
    manage_contacts: true,
    manage_team_users: false,
    manage_branding: false,
  },
  cs: {
    view_dashboard: true,
    view_powerbi: false,
    view_cash_collected: false,
    view_cases: true,
    view_map: false,
    view_workhub: false,
    view_imports: false,
    view_contacts: true,
    view_reports_perf: false,
    view_reports_expiry: false,
    view_reports_legal: false,
    view_team: false,
    view_device_logins: false,
    edit_case_details: false,
    reassign_case: false,
    gps_checkin: false,
    record_payment: false,
    log_remark: true,
    export_excel: false,
    export_xlsx: false,
    send_bulk_messages: true,
    manage_contacts: false,
    manage_team_users: false,
    manage_branding: false,
  },
  agent: {
    view_dashboard: true,
    view_powerbi: false,
    view_cash_collected: true,
    view_cases: true,
    view_map: false,
    view_workhub: false,
    view_imports: false,
    view_contacts: true,
    view_reports_perf: false,
    view_reports_expiry: false,
    view_reports_legal: true,
    view_team: false,
    view_device_logins: false,
    edit_case_details: false,
    reassign_case: false,
    gps_checkin: true,
    record_payment: true,
    log_remark: true,
    export_excel: false,
    export_xlsx: false,
    send_bulk_messages: false,
    manage_contacts: false,
    manage_team_users: false,
    manage_branding: false,
  },
};

interface PermissionsContextType {
  rolePermissions: Record<UserRole, AppPermissions>;
  userOverrides: Record<number, Partial<AppPermissions>>;
  updateRolePermissions: (role: UserRole, perms: AppPermissions) => void;
  updateUserOverrides: (userId: number, perms: Partial<AppPermissions>) => void;
  resetPermissions: () => void;
  can: (perm: PermissionKey, customUser?: User | null) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, AppPermissions>>(() => {
    const saved = localStorage.getItem('recovery_role_permissions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<UserRole, Partial<AppPermissions>>;
        // Merge saved permissions over defaults so newly added permission keys
        // (e.g. view_workhub) get their intended default instead of undefined.
        const merged = (Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRole[]).reduce((acc, role) => {
          acc[role] = { ...DEFAULT_ROLE_PERMISSIONS[role], ...(parsed?.[role] || {}) } as AppPermissions;
          return acc;
        }, {} as Record<UserRole, AppPermissions>);
        return merged;
      } catch (e) {}
    }
    return DEFAULT_ROLE_PERMISSIONS;
  });

  const [userOverrides, setUserOverrides] = useState<Record<number, Partial<AppPermissions>>>(() => {
    const saved = localStorage.getItem('recovery_user_permission_overrides');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('recovery_role_permissions', JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  useEffect(() => {
    localStorage.setItem('recovery_user_permission_overrides', JSON.stringify(userOverrides));
  }, [userOverrides]);

  const updateRolePermissions = (role: UserRole, perms: AppPermissions) => {
    setRolePermissions(prev => ({ ...prev, [role]: perms }));
  };

  const updateUserOverrides = (userId: number, perms: Partial<AppPermissions>) => {
    setUserOverrides(prev => ({ ...prev, [userId]: perms }));
  };

  const resetPermissions = () => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    setUserOverrides({});
    localStorage.removeItem('recovery_role_permissions');
    localStorage.removeItem('recovery_user_permission_overrides');
  };

  const can = (perm: PermissionKey, targetUser?: User | null): boolean => {
    const activeUser = targetUser !== undefined ? targetUser : user;
    if (!activeUser) return false;
    if (activeUser.status === 'inactive') return false;

    // Check specific user override first
    const overrides = userOverrides[activeUser.id];
    if (overrides && typeof overrides[perm] === 'boolean') {
      return overrides[perm]!;
    }

    // Fall back to role permissions
    const perms = rolePermissions[activeUser.role] || DEFAULT_ROLE_PERMISSIONS[activeUser.role];
    return !!perms[perm];
  };

  return (
    <PermissionsContext.Provider value={{
      rolePermissions,
      userOverrides,
      updateRolePermissions,
      updateUserOverrides,
      resetPermissions,
      can
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) throw new Error('usePermissions must be used within PermissionsProvider');
  return context;
};