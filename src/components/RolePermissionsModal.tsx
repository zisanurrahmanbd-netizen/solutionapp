import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions, DEFAULT_ROLE_PERMISSIONS, AppPermissions, PermissionKey } from '../context/PermissionsContext';
import { UserRole, User } from '../types';
import { 
  Shield, 
  CheckCircle2, 
  RotateCcw, 
  X, 
  Users, 
  Briefcase, 
  MapPin, 
  Receipt, 
  FileSpreadsheet, 
  Lock,
  Eye,
  Edit3
} from 'lucide-react';

interface RolePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUserId?: number | null;
}

const PERMISSION_GROUPS: {
  title: string;
  icon: any;
  items: { key: PermissionKey; label: string; desc: string }[];
}[] = [
  {
    title: 'Navigation & Menu Visibility',
    icon: Eye,
    items: [
      { key: 'view_dashboard', label: 'View Dashboard', desc: 'Can access recovery metrics & KPI cards' },
      { key: 'view_powerbi', label: 'Graphs & Analytics', desc: 'Charts of files, overdue, collection % per bank & agent + monthly targets' },
      { key: 'view_cash_collected', label: 'Total Cash Collected', desc: 'Can view cash collections & approve/reject payments' },
      { key: 'view_cases', label: 'View Bank & MNC Files', desc: 'Can view allocated loan and credit card files' },
      { key: 'view_map', label: 'Live GPS Agent Map', desc: 'Can view real-time location pins of field agents' },
      { key: 'view_workhub', label: 'WorkHub (HR) Access', desc: 'Can open the HR & Operations hub — payroll, attendance, hiring, leave & more' },
      { key: 'view_imports', label: 'Daily File Upload', desc: 'Can upload the daily recovery file (Excel)' },
      { key: 'view_contacts', label: 'Bank Contacts Directory', desc: 'Can view institution contacts and phone directory' },
      { key: 'view_reports_perf', label: 'Agent Performance Reports', desc: 'Can view collection rankings and visit stats' },
      { key: 'view_reports_expiry', label: 'Expiry Matrix Tracker', desc: 'Can view contract expiry & overdue buckets' },
      { key: 'view_reports_legal', label: 'Legal & Flagged Registry', desc: 'Can view court cases & untraceable accounts' },
      { key: 'view_team', label: 'Team & User Management', desc: 'Can view system user list and team hierarchy' },
      { key: 'view_device_logins', label: 'Device Logins & Activity', desc: 'Can view login history and active device sessions' },
    ],
  },
  {
    title: 'Case Operations & GPS Actions',
    icon: Edit3,
    items: [
      { key: 'edit_case_details', label: 'Edit Case Info & Customer Details', desc: 'Can edit customer phones, notes, and addresses' },
      { key: 'reassign_case', label: 'Reassign Case Files', desc: 'Can change assigned agent on a case file' },
      { key: 'gps_checkin', label: 'Submit GPS Field Check-In', desc: 'Can log verified visit coordinates & timestamps' },
      { key: 'log_remark', label: 'Log Contact Remarks & PTP', desc: 'Can record promise-to-pay and customer remarks' },
    ],
  },
  {
    title: 'Financials & Administrative Powers',
    icon: Shield,
    items: [
      { key: 'record_payment', label: 'Record Cash & Bank Collections', desc: 'Can submit money collections and receipt numbers' },
      { key: 'export_excel', label: 'Export Reports to PDF', desc: 'Can download landscape audit and case PDF reports' },
      { key: 'export_xlsx', label: 'Export Files to Excel (.xlsx)', desc: 'Can download real Excel spreadsheets of Bank & MNC files' },
      { key: 'send_bulk_messages', label: 'Bulk WhatsApp & Email Messaging', desc: 'Can send one message to many selected contacts/customers at once' },
      { key: 'manage_contacts', label: 'Create & Edit Bank Contacts', desc: 'Can add new banker numbers and branches' },
      { key: 'manage_team_users', label: 'Create, Edit & Deactivate Users', desc: 'Can manage employee credentials and status' },
      { key: 'manage_branding', label: 'Brand & Logo Customizer', desc: 'Can change system logos, titles, and themes' },
    ],
  },
];

export const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({ isOpen, onClose, initialUserId }) => {
  const { users } = useAuth();
  const { rolePermissions, userOverrides, updateRolePermissions, updateUserOverrides, resetPermissions } = usePermissions();

  const [activeTab, setActiveTab] = useState<'roles' | 'users'>(initialUserId ? 'users' : 'roles');
  const [selectedRole, setSelectedRole] = useState<UserRole>('agent');
  const [selectedUserId, setSelectedUserId] = useState<number>(initialUserId || (users[0]?.id || 1));
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentRolePerms: AppPermissions = rolePermissions[selectedRole] || DEFAULT_ROLE_PERMISSIONS[selectedRole];
  const targetUser = users.find(u => u.id === selectedUserId);
  const currentUserOverrides = userOverrides[selectedUserId] || {};

  const toggleRolePerm = (key: PermissionKey) => {
    const next = { ...currentRolePerms, [key]: !currentRolePerms[key] };
    updateRolePermissions(selectedRole, next);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1500);
  };

  const toggleUserPerm = (key: PermissionKey) => {
    if (!targetUser) return;
    const baseVal = rolePermissions[targetUser.role]?.[key] ?? DEFAULT_ROLE_PERMISSIONS[targetUser.role][key];
    const currentVal = typeof currentUserOverrides[key] === 'boolean' ? currentUserOverrides[key]! : baseVal;
    const next = { ...currentUserOverrides, [key]: !currentVal };
    updateUserOverrides(selectedUserId, next);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1500);
  };

  const clearUserOverride = (key: PermissionKey) => {
    const next = { ...currentUserOverrides };
    delete next[key];
    updateUserOverrides(selectedUserId, next);
  };

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Role & Permission Access Control (Admin)
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure what every user and role can see, edit, and access across the application
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector: By Role vs By Individual User */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl">
            <button
              onClick={() => setActiveTab('roles')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'roles'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Role Defaults ({selectedRole.toUpperCase()})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'users'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Custom User Overrides ({users.length} Users)
            </button>
          </div>

          {savedSuccess && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Permission Updated & Saved!</span>
            </span>
          )}
        </div>

        {/* Sub Selector */}
        {activeTab === 'roles' ? (
          <div className="flex items-center gap-2">
            {(['agent', 'cs', 'manager', 'admin'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border ${
                  selectedRole === role
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {role === 'agent' ? 'Field Agents' : role === 'manager' ? 'Managers' : role === 'cs' ? 'Customer Service (C.S.)' : 'Administrators'}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Select Specific User to Customize:
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.toUpperCase()} - {u.employee_id || 'ID'}) [{u.status.toUpperCase()}]
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Permission Checkboxes by Group */}
        <div className="space-y-4 pt-2">
          {PERMISSION_GROUPS.map(group => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/60 pb-2">
                  <Icon className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    {group.title}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {group.items.map(item => {
                    let isChecked = false;
                    let isOverridden = false;

                    if (activeTab === 'roles') {
                      isChecked = !!currentRolePerms[item.key];
                    } else if (targetUser) {
                      const baseVal = rolePermissions[targetUser.role]?.[item.key] ?? DEFAULT_ROLE_PERMISSIONS[targetUser.role][item.key];
                      if (typeof currentUserOverrides[item.key] === 'boolean') {
                        isChecked = currentUserOverrides[item.key]!;
                        isOverridden = true;
                      } else {
                        isChecked = baseVal;
                      }
                    }

                    return (
                      <label
                        key={item.key}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => activeTab === 'roles' ? toggleRolePerm(item.key) : toggleUserPerm(item.key)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-bold flex items-center justify-between">
                            <span>{item.label}</span>
                            {isOverridden && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  clearUserOverride(item.key);
                                }}
                                title="Reset to role default"
                                className="text-[10px] text-amber-500 hover:underline font-normal"
                              >
                                (Custom - Reset)
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-medium leading-tight">
                            {item.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              if (confirm('Reset all roles and user permissions back to standard defaults?')) {
                resetPermissions();
              }
            }}
            className="px-3.5 py-2 text-slate-500 hover:text-rose-500 font-bold text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Factory Permissions</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30"
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
};