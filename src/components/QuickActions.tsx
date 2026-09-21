import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { 
  Zap, X, Plus, Search, MapPin, FileText, Users, 
  PhoneCall, ArrowUpRight, Briefcase 
} from 'lucide-react';

interface QuickActionsProps {
  onNavigate: (page: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const actions: {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    perm?: string;
  }[] = [
    { 
      label: 'New Case', 
      icon: Plus, 
      onClick: () => onNavigate('cases'),
      perm: 'view_cases'
    },
    { 
      label: 'Agent Map', 
      icon: MapPin, 
      onClick: () => onNavigate('map'),
      perm: 'view_map'
    },
    { 
      label: 'WorkHub (HR)', 
      icon: Briefcase, 
      onClick: () => onNavigate('workhub'),
      perm: 'view_workhub'
    },
    { 
      label: 'Bank Contacts', 
      icon: PhoneCall, 
      onClick: () => onNavigate('contacts'),
      perm: 'view_contacts'
    },
    { 
      label: 'Performance', 
      icon: FileText, 
      onClick: () => onNavigate('reports_perf'),
      perm: 'view_reports_perf'
    },
    { 
      label: 'Team', 
      icon: Users, 
      onClick: () => onNavigate('team'),
      perm: 'view_team'
    },
    { 
      label: 'File Export', 
      icon: Briefcase, 
      onClick: () => onNavigate('file_export'),
      perm: 'export_excel'
    },
  ];

  const visibleActions = actions.filter(a => !a.perm || can(a.perm as any));

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Expanded Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 space-y-1.5 min-w-[180px] animate-fade-in">
          <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Quick Actions
          </div>
          {visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => {
                  action.onClick();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                <Icon className="w-3.5 h-3.5 text-zinc-500" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center transition-all ${
          isOpen 
            ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black rotate-45' 
            : 'bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
        }`}
        title="Quick Actions"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
      </button>
    </div>
  );
};
