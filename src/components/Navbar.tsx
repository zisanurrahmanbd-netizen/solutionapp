import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, LogOut, Search, UserCheck, Shield, ChevronDown, Palette } from 'lucide-react';
import { BrandingModal } from './BrandingModal';
import { RolePermissionsModal } from './RolePermissionsModal';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../context/LanguageContext';
import { usePermissions } from '../context/PermissionsContext';
import { dataService } from '../services/dataService';

interface NavbarProps {
  onSearch?: (query: string) => void;
  onMenuToggle?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSearch, onMenuToggle, isCollapsed, onToggleCollapse }) => {
  const { user, logout, users } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { can } = usePermissions();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [showPermsModal, setShowPermsModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          {/* Mobile drawer toggle */}
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Toggle Mobile Navigation"
          >
            <i className="fa-solid fa-bars text-lg"></i>
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <i className={`fa-solid ${isCollapsed ? 'fa-angles-right' : 'fa-angles-left'} text-sm`}></i>
          </button>

          <div className="relative w-full hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('top.search_placeholder', 'Quick search file #, customer, phone...')}
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Admin Role & Permission Control */}
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowPermsModal(true)}
              title="Configure Role & User Access Permissions"
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-zinc-300 dark:border-zinc-700 shadow-sm"
            >
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden xl:inline">{t('top.permissions', 'Permissions')}</span>
            </button>
          )}

          {/* Admin Branding Customizer (respects manage_branding permission) */}
          {can('manage_branding') && (
            <button
              onClick={() => setShowBrandingModal(true)}
              title="Customize Logo, Head Text & Subtitle"
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-zinc-300 dark:border-zinc-700 shadow-sm"
            >
              <Palette className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden xl:inline">{t('top.branding', 'Edit Logo & Brand')}</span>
            </button>
          )}

          {/* 1-Click Language Switcher (EN / বাংলা) */}
          <LanguageToggle />

          {/* Theme Toggle */}            <button
            onClick={toggleTheme}
            title={theme === 'dark' ? t('top.light_mode', 'Light Mode') : t('top.dark_mode', 'Dark Mode')}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm flex-shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* User Dropdown & Role Switching */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-xs shadow-md flex-shrink-0">
                {user?.name.charAt(0)}
              </div>
              <div className="hidden lg:block text-left max-w-[110px] xl:max-w-[150px]">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate">{user?.name}</div>
                <div className="text-[10px] text-slate-400 capitalize truncate">{user?.role}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{user?.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {user?.role}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {users.length} {users.length === 1 ? 'user' : 'users'} in system
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-1">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Admin Branding Customizer Modal */}
      <BrandingModal
        isOpen={showBrandingModal}
        onClose={() => setShowBrandingModal(false)}
      />

      {/* Admin Role & Permissions Control Modal */}
      <RolePermissionsModal
        isOpen={showPermsModal}
        onClose={() => setShowPermsModal(false)}
      />
    </>
  );
};