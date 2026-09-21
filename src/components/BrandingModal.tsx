import React, { useState, useRef } from 'react';
import { useBranding, DEFAULT_BRANDING, BrandingConfig } from '../context/BrandingContext';
import { Sparkles, Palette, Save, RotateCcw, X, Image, Upload, Trash2, CheckCircle2 } from 'lucide-react';

interface BrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_ICONS = [
  { class: 'fa-vault', label: 'Vault' },
  { class: 'fa-building-columns', label: 'Bank' },
  { class: 'fa-shield-halved', label: 'Security' },
  { class: 'fa-landmark', label: 'Landmark' },
  { class: 'fa-coins', label: 'Coins' },
  { class: 'fa-scale-balanced', label: 'Legal' },
  { class: 'fa-briefcase', label: 'Briefcase' },
  { class: 'fa-chart-pie', label: 'Analytics' },
];

export const BrandingModal: React.FC<BrandingModalProps> = ({ isOpen, onClose }) => {
  const { branding, updateBranding, resetBranding } = useBranding();
  const [form, setForm] = useState<BrandingConfig>({ ...branding });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Please choose an image file under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setForm({ ...form, customLogoUrl: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveCustomLogo = () => {
    setForm({ ...form, customLogoUrl: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateBranding(form);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 500);
  };

  const handleReset = () => {
    if (confirm('Reset system branding and logo back to defaults?')) {
      resetBranding();
      setForm(DEFAULT_BRANDING);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Brand & Logo Customizer (Admin)
              </h3>
              <p className="text-[11px] text-slate-500">
                Upload device logo, customize system title and subtitles
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Header Preview</span>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-xl shadow-lg overflow-hidden flex-shrink-0">
              {form.customLogoUrl ? (
                <img src={form.customLogoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <i className={`fa-solid ${form.logoIcon || 'fa-vault'}`}></i>
              )}
            </div>
            <div className="overflow-hidden">
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight leading-none truncate">
                {form.headerText || 'RecoveryPRO'}
              </h4>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate block mt-0.5">
                {form.underText || 'Bank Telemetry V2'}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Logo Upload Section */}
          <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-3">
            <label className="block font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Upload Custom Logo from Device</span>
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFileUpload}
                className="hidden"
                id="logo-upload-input"
              />
              <label
                htmlFor="logo-upload-input"
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-purple-600/30"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Image File (PNG/JPG/SVG)</span>
              </label>

              {form.customLogoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveCustomLogo}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Uploaded Logo</span>
                </button>
              )}
            </div>

            {form.customLogoUrl && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Custom image logo loaded and ready to apply!</span>
              </div>
            )}
          </div>

          {/* Or Preset Icons */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Or Select Preset Icon</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_ICONS.map(icon => (
                <button
                  type="button"
                  key={icon.class}
                  onClick={() => setForm({ ...form, logoIcon: icon.class, customLogoUrl: '' })}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    form.logoIcon === icon.class && !form.customLogoUrl
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-300 font-bold'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <i className={`fa-solid ${icon.class} text-base`}></i>
                  <span className="text-[10px]">{icon.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Header & Under Text */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Main Header Text (Sidebar / App Title)
              </label>
              <input
                type="text"
                required
                value={form.headerText}
                onChange={(e) => setForm({ ...form, headerText: e.target.value })}
                placeholder="e.g. RecoveryPRO"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Header Under Text (Subtitle)
              </label>
              <input
                type="text"
                required
                value={form.underText}
                onChange={(e) => setForm({ ...form, underText: e.target.value })}
                placeholder="e.g. Bank Telemetry V2"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-medium"
              />
            </div>
          </div>

          {/* Login Screen Customization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Login Page Title
              </label>
              <input
                type="text"
                required
                value={form.loginTitle}
                onChange={(e) => setForm({ ...form, loginTitle: e.target.value })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Login Page Under Text
              </label>
              <input
                type="text"
                required
                value={form.loginSubtitle}
                onChange={(e) => setForm({ ...form, loginSubtitle: e.target.value })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-medium"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-xl text-slate-500 hover:text-rose-500 font-bold text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold flex items-center gap-2 shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>{saveSuccess ? 'Saved!' : 'Apply Branding'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};