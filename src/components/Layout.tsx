import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { OfflineBanner } from './OfflineBanner';

interface LayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onSearch?: (query: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentPage, onNavigate, onSearch, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex transition-colors">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className={`flex-1 ${isCollapsed ? 'lg:pl-20' : 'lg:pl-64'} flex flex-col min-w-0 max-w-full overflow-x-hidden transition-[padding] duration-300`}>
        <OfflineBanner />
        <Navbar
          onSearch={onSearch}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main className="flex-1 p-3 sm:p-5 md:p-7 w-full max-w-[1700px] mx-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};