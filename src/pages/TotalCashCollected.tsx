import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { Collection, CaseFile } from '../types';
import { 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2, 
  Search, 
  Camera, 
  ChevronRight
} from 'lucide-react';

interface TotalCashCollectedProps {
  onSelectCase?: (caseId: number) => void;
}

export const TotalCashCollected: React.FC<TotalCashCollectedProps> = ({ onSelectCase }) => {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingCol, setRejectingCol] = useState<Collection | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Amount does not match receipt');

  const [refreshKey, setRefreshKey] = useState(0);

  const collections = useMemo(() => {
    const all = dataService.getAllCollections();
    if (user?.role === 'agent') {
      return all.filter(c => c.agent_id === user.id);
    }
    return all;
  }, [user, refreshKey]);

  const allCases = useMemo(() => {
    return dataService.getCases(user!);
  }, [user, refreshKey]);

  const caseMap = useMemo(() => {
    const map = new Map<number, CaseFile>();
    // For admin, load all cases so every collection file matches
    const casesToMap = user?.role === 'admin' ? dataService.getCases({ role: 'admin' } as any) : allCases;
    casesToMap.forEach(c => map.set(c.id, c));
    return map;
  }, [allCases, user]);

  // Calculations
  const stats = useMemo(() => {
    let totalCollected = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let rejectedAmount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    collections.forEach(c => {
      totalCollected += Number(c.amount) || 0;
      const st = c.status || 'pending';
      if (st === 'approved') {
        approvedAmount += Number(c.amount) || 0;
        approvedCount++;
      } else if (st === 'rejected') {
        rejectedAmount += Number(c.amount) || 0;
        rejectedCount++;
      } else {
        pendingAmount += Number(c.amount) || 0;
        pendingCount++;
      }
    });

    return {
      totalCollected,
      approvedAmount,
      pendingAmount,
      rejectedAmount,
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCount: collections.length
    };
  }, [collections]);

  const filtered = useMemo(() => {
    return collections.filter(c => {
      const st = c.status || 'pending';
      if (filterStatus !== 'all' && st !== filterStatus) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const cItem = caseMap.get(c.case_file_id);
        const matchFile = cItem?.file_number.toLowerCase().includes(q);
        const matchCust = cItem?.customer_name.toLowerCase().includes(q);
        const matchRec = c.receipt_number?.toLowerCase().includes(q);
        const matchAgent = c.agent?.name?.toLowerCase().includes(q);
        if (!matchFile && !matchCust && !matchRec && !matchAgent) return false;
      }

      return true;
    });
  }, [collections, filterStatus, searchTerm, caseMap]);

  const handleApprove = (id: number) => {
    dataService.verifyCollection(id, 'approved', undefined, user?.name || 'Admin');
    setRefreshKey(k => k + 1);
  };

  const handleOpenRejectModal = (col: Collection) => {
    setRejectingCol(col);
    setRejectionReason('Amount does not match deposit');
  };

  const handleConfirmReject = () => {
    if (!rejectingCol) return;
    dataService.verifyCollection(rejectingCol.id, 'rejected', rejectionReason, user?.name || 'Admin');
    setRejectingCol(null);
    setRefreshKey(k => k + 1);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this payment record? It will be permanently removed.')) {
      dataService.deleteCollection(id);
      setRefreshKey(k => k + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Total Cash Collected & Verifications</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review, approve, or reject field recovery collections and sync status to assigned agents
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Collections</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            BDT {stats.totalCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{stats.totalCount} payment entries</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Approved (Verified)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            BDT {stats.approvedAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600/70 mt-0.5">{stats.approvedCount} approved files</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Pending Verification</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            BDT {stats.pendingAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-600/70 mt-0.5">{stats.pendingCount} awaiting approval</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Rejected / Disputed</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
            BDT {stats.rejectedAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-600/70 mt-0.5">{stats.rejectedCount} payments rejected</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by file #, customer name, receipt #, agent..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all ${
                filterStatus === st
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {st} {st === 'pending' && stats.pendingCount > 0 && `(${stats.pendingCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Collections Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">File & Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment Method / Receipt</th>
                <th className="py-3 px-4">Collected Date</th>
                <th className="py-3 px-4">Agent</th>
                <th className="py-3 px-4">Proof Photo</th>
                <th className="py-3 px-4">Verification Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-sm">No payment records found</p>
                    <p className="text-xs mt-1">Payments recorded on case files will appear here for verification</p>
                  </td>
                </tr>
              )}
              {filtered.map(c => {
                const cItem = caseMap.get(c.case_file_id);
                const st = c.status || 'pending';

                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      {cItem ? (
                        <button
                          onClick={() => onSelectCase?.(cItem.id)}
                          className="text-left group"
                        >
                          <div className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 flex items-center gap-1">
                            {cItem.file_number}
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">{cItem.customer_name}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{cItem.bank?.name}</div>
                        </button>
                      ) : (
                        <span className="font-mono text-slate-400">Case #{c.case_file_id}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      BDT {Number(c.amount).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{c.payment_method.replace('_', ' ')}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {c.receipt_number ? `#${c.receipt_number}` : 'No receipt #'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {c.collected_at ? new Date(c.collected_at).toLocaleDateString() : 'N/A'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {c.agent?.name || 'Assigned Agent'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {c.photo_url ? (
                        <button
                          onClick={() => setSelectedPhoto(c.photo_url!)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold transition-all border border-emerald-500/30"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>View Photo</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No Photo</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {st === 'approved' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                          {c.verified_by && (
                            <div className="text-[9px] text-slate-400 mt-0.5">by {c.verified_by}</div>
                          )}
                        </div>
                      )}
                      {st === 'rejected' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                          {c.rejection_reason && (
                            <div className="text-[10px] text-rose-500 font-medium mt-0.5 max-w-[150px] leading-tight">
                              Note: {c.rejection_reason}
                            </div>
                          )}
                        </div>
                      )}
                      {st === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {user?.role !== 'agent' && (
                          <>
                            {st !== 'approved' && (
                              <button
                                onClick={() => handleApprove(c.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition-all shadow-sm"
                                title="Approve and confirm collection"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                            )}
                            {st !== 'rejected' && (
                              <button
                                onClick={() => handleOpenRejectModal(c)}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[11px] flex items-center gap-1 transition-all border border-rose-500/30"
                                title="Reject payment with reason note"
                              >
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                          title="Delete collection permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl max-w-lg w-full space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-500" /> Payment Receipt Proof
              </h4>
              <button onClick={() => setSelectedPhoto(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold text-base">✕</button>
            </div>
            <img src={selectedPhoto} alt="Payment Receipt" className="rounded-2xl max-h-[70vh] w-full object-contain border border-slate-100 dark:border-slate-800" />
            <div className="flex justify-end">
              <button onClick={() => setSelectedPhoto(null)} className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payment with Reason Modal */}
      {rejectingCol && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-3 shadow-2xl text-xs">
            <h4 className="font-bold text-sm text-rose-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Reject Payment Record
            </h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Specify the reason why this collection of <b>BDT {rejectingCol.amount.toLocaleString()}</b> is being rejected. The assigned agent will see this note.
            </p>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-600 dark:text-slate-300">Rejection Reason</label>
              <select
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              >
                <option value="Amount was not right / Does not match bank deposit">Amount was not right / Does not match deposit</option>
                <option value="Customer did not actually pay / Fake slip">Customer did not pay / Fake receipt slip</option>
                <option value="Cheque dishonoured / Bounced">Cheque dishonoured / Bounced</option>
                <option value="Duplicate payment entry">Duplicate payment entry</option>
                <option value="Proof photo unclear or missing receipt stamp">Proof photo unclear or missing receipt stamp</option>
                <option value="Other discrepancy">Other discrepancy</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingCol(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/30"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};