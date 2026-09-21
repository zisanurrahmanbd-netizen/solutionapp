import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Languages } from 'lucide-react';

interface LanguageToggleProps {
  className?: string;
  showIcon?: boolean;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '', showIcon = true }) => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={language === 'en' ? 'Switch to Bangla (বাংলায় পরিবর্তন করুন)' : 'Switch to English (ইংরেজিতে পরিবর্তন করুন)'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm ${className}`}
    >
      {showIcon && <Languages className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
      <span className="flex items-center gap-1">
        <span className={language === 'en' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-slate-400 font-normal'}>
          EN
        </span>
        <span className="text-slate-300 dark:text-slate-600 text-[10px]">/</span>
        <span className={language === 'bn' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold font-serif' : 'text-slate-400 font-normal'}>
          বাংলা
        </span>
      </span>
    </button>
  );
};