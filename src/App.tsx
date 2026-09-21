import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CasesList } from './pages/CasesList';
import { CaseDetail } from './pages/CaseDetail';
import { TrackingMap } from './pages/TrackingMap';
import { BankContactsPage } from './pages/BankContacts';
import { AgentPerformancePage } from './pages/AgentPerformance';
import { ExpiryTrackerPage } from './pages/ExpiryTracker';
import { FlaggedCasesPage } from './pages/FlaggedCases';
import { TeamManagementPage } from './pages/TeamManagement';
import { ExcelUploadPage } from './pages/ExcelUpload';
import { DeviceLoginsPage } from './pages/DeviceLogins';
import { TotalCashCollected } from './pages/TotalCashCollected';
import { FileUpdateExportPage } from './pages/FileUpdateExport';
import { QuickActions } from './components/QuickActions';
import { WorkHubPage } from './pages/WorkHub';
import { PowerBIDashboard } from './pages/PowerBIDashboard';
import { BulkMessagesPage } from './pages/BulkMessages';
import { startBackgroundPinger } from './services/hrService';

export const App: React.FC = () => {
  const { user, updateUserLocation } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  // NOTE: Google Sheet sync has been fully removed — data comes from the
  // Daily File Upload page (admin uploads the .xlsx). Supabase realtime
  // propagates every change to all devices instantly.
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── 24/7 Agent Tracking: background GPS pinger ─────────────────────────
  // Records every location update to location_pings (trail history) and
  // keeps updating the users table last_latitude/longitude via AuthContext.
  // IMPORTANT: all hooks must run unconditionally on every render (before
  // any early return) — otherwise React throws error #310 when `user`
  // changes from null to a logged-in user (e.g. right after login).
  useEffect(() => {
    if (!user) return;
    return startBackgroundPinger(user.id, updateUserLocation);
  }, [user?.id, updateUserLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return <Login />;
  }

  const handleSelectCase = (id: number) => {
    setSelectedCaseId(id);
    setCurrentPage('case_detail');
  };

  const handleBackToCases = () => {
    setSelectedCaseId(null);
    setCurrentPage('cases');
  };

  const renderContent = () => {
    if (currentPage === 'case_detail' && selectedCaseId) {
      return <CaseDetail caseId={selectedCaseId} onBack={handleBackToCases} />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onSelectCase={handleSelectCase} onNavigate={setCurrentPage} />;
      case 'powerbi':
        return <PowerBIDashboard />;
      case 'cases':
        return <CasesList onSelectCase={handleSelectCase} searchQuery={searchQuery} />;
      case 'map':
        return <TrackingMap />;
      case 'workhub':
        return <WorkHubPage />;
      case 'excel_upload':
        return <ExcelUploadPage />;
      case 'contacts':
        return <BankContactsPage />;
      case 'reports_perf':
        return <AgentPerformancePage />;
      case 'reports_expiry':
        return <ExpiryTrackerPage />;
      case 'reports_legal':
        return <FlaggedCasesPage onSelectCase={handleSelectCase} />;
      case 'file_export':
        return <FileUpdateExportPage onSelectCase={handleSelectCase} />;
      case 'bulk_messages':
        return <BulkMessagesPage />;
      case 'cash_collected':
        return <TotalCashCollected onSelectCase={handleSelectCase} />;
      case 'team':
        return <TeamManagementPage />;
      case 'device_logins':
        return <DeviceLoginsPage />;
      default:
        return <Dashboard onSelectCase={handleSelectCase} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={(page) => {
        setSelectedCaseId(null);
        setCurrentPage(page);
      }}
      onSearch={setSearchQuery}
    >
      {renderContent()}
      <QuickActions onNavigate={(page) => {
        setSelectedCaseId(null);
        setCurrentPage(page);
      }} />
    </Layout>
  );
};
