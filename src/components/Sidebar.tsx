import React, { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { useBranding } from "../context/BrandingContext";
import { usePermissions, PermissionKey } from "../context/PermissionsContext";
import { useLanguage } from "../context/LanguageContext";
import { dataService } from "../services/dataService";
import {
  LayoutDashboard,
  Briefcase,
  MapPin,
  Users,
  PhoneCall,
  ShieldAlert,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
  UserPlus,
  UploadCloud,
  Laptop,
  LayoutGrid,
  DollarSign,
  BarChart3,
  FileDown,
  MessageSquareMore,
  ChevronLeft,
  ChevronRight,
  Smartphone
} from "lucide-react";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentPage, 
  onNavigate, 
  isOpen, 
  onClose,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { user, users } = useAuth();
  const { canInstall, installed, isIOS, install } = useInstallPrompt();
  const { branding } = useBranding();
  const { can } = usePermissions();
  const { t } = useLanguage();

  // Real-time detection of agents mentioned in files whose user accounts are not created yet
  const unregisteredAgents = useMemo(() => {
    return dataService.getUnregisteredAgents(users);
  }, [users, currentPage]);

  // Real-time detection of collectors / C.S mentioned in files who are missing from Bank Contacts
  const missingCollectors = useMemo(() => {
    return dataService.getMissingCollectorContacts(user || undefined);
  }, [user, currentPage]);

  // Real-time detection of collections needing review or rejected for the logged in agent
  const { unverifiedCollectionsCount, rejectedCountForUser } = useMemo(() => {
    const all = dataService.getAllCollections();
    const unverified = all.filter(c => !c.status || c.status === 'pending').length;
    const rejected = all.filter(c => c.status === 'rejected' && (user?.role === 'admin' || c.agent_id === user?.id)).length;
    return { unverifiedCollectionsCount: user?.role === 'admin' ? unverified : 0, rejectedCountForUser: rejected };
  }, [user, currentPage]);

  const navItems: { id: string; label: string; icon: any; perm: PermissionKey; badge?: number; section: string }[] = [
    { id: "dashboard", label: t("nav.dashboard", "Dashboard"), icon: LayoutDashboard, perm: "view_dashboard", section: "Overview" },
    { id: "powerbi", label: "Graphs & Analytics", icon: BarChart3, perm: "view_powerbi", section: "Overview" },
    { id: "cases", label: t("nav.cases", "Bank & MNC Files"), icon: Briefcase, perm: "view_cases", section: "Operations" },
    { id: "file_export", label: "File Update Export", icon: FileDown, perm: "export_excel", section: "Operations" },
    { id: "bulk_messages", label: "Bulk Messages", icon: MessageSquareMore, perm: "send_bulk_messages", section: "Operations" },
    { id: "map", label: t("nav.map", "Live Agent Map"), icon: MapPin, perm: "view_map", section: "Operations" },
    { id: "workhub", label: "WorkHub (HR)", icon: LayoutGrid, perm: "view_workhub", section: "HR & Team" },
    { id: "excel_upload", label: "Daily File Upload", icon: UploadCloud, perm: "view_imports", section: "Operations" },
    { 
      id: "contacts", 
      label: t("nav.contacts", "Bank Contacts"), 
      icon: PhoneCall, 
      perm: "view_contacts",
      section: "Operations",
      badge: missingCollectors.length > 0 ? missingCollectors.length : undefined
    },
    { id: "reports_perf", label: t("nav.reports_perf", "Agent Performance"), icon: TrendingUp, perm: "view_reports_perf", section: "Reports" },
    { id: "reports_expiry", label: t("nav.reports_expiry", "Expiry Tracker"), icon: CalendarClock, perm: "view_reports_expiry", section: "Reports" },
    { id: "reports_legal", label: t("nav.reports_legal", "Legal & Flagged Cases"), icon: ShieldAlert, perm: "view_reports_legal", section: "Reports" },
    { 
      id: "cash_collected", 
      label: "Total Cash Collected", 
      icon: DollarSign, 
      perm: "view_cash_collected",
      section: "Finance",
      badge: unverifiedCollectionsCount > 0 ? unverifiedCollectionsCount : (rejectedCountForUser > 0 ? rejectedCountForUser : undefined)
    },
    { 
      id: "team", 
      label: t("nav.team", "Team Management"), 
      icon: Users, 
      perm: "view_team",
      section: "HR & Team",
      badge: unregisteredAgents.length > 0 ? unregisteredAgents.length : undefined
    },
    { 
      id: "device_logins", 
      label: "Device Logins & Activity", 
      icon: Laptop, 
      perm: "view_device_logins",
      section: "HR & Team" 
    },
  ];

  const allowedItems = navItems.filter(item => user && can(item.perm));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 ${
          isCollapsed ? "w-20" : "w-64"
        } bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Dynamic Logo Brand Header */}
          <div className={`h-16 ${isCollapsed ? "px-3 justify-center" : "px-4 sm:px-5 justify-between"} flex items-center border-b border-slate-200 dark:border-slate-800 relative`}>
            <div className="flex items-center gap-3 overflow-hidden">
            <div 
              onClick={onToggleCollapse}
              title={branding.headerText}
              className="w-10 h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-lg shadow-lg overflow-hidden flex-shrink-0 cursor-pointer"
            >
                {branding.customLogoUrl ? (
                  <img src={branding.customLogoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <i className={`fa-solid ${branding.logoIcon || "fa-vault"}`}></i>
                )}
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden min-w-0">
                  <h1 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight tracking-tight truncate">
                    {branding.headerText}
                  </h1>
                  <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
                    {branding.underText}
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Collapse Button */}
            {!isCollapsed && onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-auto flex-shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Items grouped by section */}
          <nav className={`p-2 sm:p-3 space-y-1 overflow-y-auto flex-1 custom-scrollbar`}>
            {allowedItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              const showHeader = !isCollapsed && (idx === 0 || allowedItems[idx - 1].section !== item.section);
              return (
                <React.Fragment key={item.id}>
                  {showHeader && (
                    <div className={`pt-2 pb-1 ${idx === 0 ? "" : "mt-2 border-t border-zinc-200 dark:border-zinc-800"}`}>
                      <span className="px-3.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                        {item.section}
                      </span>
                    </div>
                  )}
                <button
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${isCollapsed ? "justify-center px-2 py-3" : "justify-between px-3.5 py-2.5"} rounded-2xl font-bold text-xs transition-all relative group ${
                    isActive
                      ? "bg-black dark:bg-white text-white dark:text-black shadow-lg"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3 truncate"}`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {item.badge !== undefined && (
                    isCollapsed ? (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] shadow-sm animate-pulse">
                        ! {item.badge}
                      </span>
                    )
                  )}

                  {/* Tooltip for collapsed mode */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
                      {item.label}
                      {item.badge !== undefined && ` (${item.badge})`}
                    </div>
                  )}
                </button>
                </React.Fragment>
              );
            })}

            {/* Unregistered Agents Alert Notification in Sidebar */}
            {unregisteredAgents.length > 0 && user?.role === "admin" && (
              <div 
                onClick={() => { onNavigate("team"); onClose(); }}
                className={`mt-3 ${isCollapsed ? "p-2 text-center" : "p-3"} rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer space-y-1.5 relative group`}
                title="Click to register missing agent accounts"
              >
                {isCollapsed ? (
                  <div className="flex justify-center">
                    <AlertTriangle className="w-4 h-4 text-zinc-500 animate-pulse" />
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-amber-900 text-amber-100 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
                      {unregisteredAgents.length} Unregistered Agents Found
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 font-extrabold text-[11px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-zinc-500 animate-pulse flex-shrink-0" />
                        <span className="truncate">Unregistered Agents</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-black text-[9px] flex-shrink-0">
                        {unregisteredAgents.length} pending
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {unregisteredAgents.map(a => a.name).join(", ")} found in recovery files.
                    </p>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 pt-0.5">
                      <UserPlus className="w-3 h-3" />
                      <span>Create Agent Accounts →</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Install App button (PWA) */}
        {canInstall && !installed && (
          <div className={`px-3 pb-1 ${isCollapsed ? "flex justify-center" : ""}`}>
            <button
              onClick={() => install()}
              className={isCollapsed
                ? "w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-80 transition-opacity"
                : "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-80 transition-opacity"}
              title="Install RecoveryCORE on this device"
            >
              <Smartphone className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>{isIOS ? "Add to Home Screen" : "Install App"}</span>}
            </button>
          </div>
        )}

        {/* User Card at Bottom */}
        <div className={`p-3 border-t border-slate-200 dark:border-slate-800 ${isCollapsed ? "flex justify-center" : ""}`}>
          {isCollapsed ? (              <div 
              title={`${user?.name} (${user?.role})`}
              className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold flex items-center justify-center text-xs flex-shrink-0 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {user?.name.charAt(0)}
            </div>
          ) : (
            <div className="p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold flex items-center justify-center text-xs flex-shrink-0">
                {user?.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-400 capitalize truncate">{user?.role} • {user?.employee_id || "ID"}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};