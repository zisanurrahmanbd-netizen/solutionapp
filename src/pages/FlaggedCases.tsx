import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { dataService } from '../services/dataService';
import { StatusBadge } from '../components/StatusBadge';
import { ShieldAlert, AlertOctagon, UserX, PhoneOff } from 'lucide-react';

interface FlaggedCasesProps {
  onSelectCase: (caseId: number) => void;
}

export const FlaggedCasesPage: React.FC<FlaggedCasesProps> = ({ onSelectCase }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const allCases = dataService.getCases(user!);
  
  const flagged = allCases.filter(c => ['legal', 'untraceable', 'broken_promise', 'disputed'].includes(c.status));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t('legal.title', 'Legal & High-Risk Flagged Registry')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t('legal.subtitle', 'Cases requiring court suits, Artha Rin proceedings, 138 NI Act notices, or untraceable investigations')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">{t('cases.customer', 'File / Customer')}</th>
                <th className="py-3 px-4">{t('cases.bank_product', 'Bank / Product')}</th>
                <th className="py-3 px-4">{t('cases.status', 'Flag Category')}</th>
                <th className="py-3 px-4">{t('top.switch_lang') === 'English' ? 'à¦†à¦‡à¦¨à¦¿ à¦®à¦¨à§à¦¤à¦¬à§à¦¯' : 'Legal Notes'}</th>
                <th className="py-3 px-4 text-right">{t('cases.outstanding', 'Outstanding')} (BDT)</th>
                <th className="py-3 px-4 text-right">{t('cases.action', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {flagged.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-medium">
                    <div className="font-bold text-slate-900 dark:text-white">{c.customer_name}</div>
                    <div className="text-[11px] font-mono text-slate-400">{c.file_number}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    <div>{c.bank?.name}</div>
                    <div className="text-[10px] text-slate-400">{c.product?.name}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    {c.legal_status || c.availability_status || 'Under dispute investigation'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    BDT {c.outstanding_amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onSelectCase(c.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      {t('cases.view_detail', 'Open Case')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};