import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageToggle } from '../components/LanguageToggle';
import { useBranding } from '../context/BrandingContext';
import { sendOtpToEmail } from '../services/emailService';
import {
  Lock, Mail, Eye, EyeOff, ArrowRight,
  Sun, Moon, ShieldCheck, KeyRound, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';

type Step = 'credentials' | 'otp';

export const Login: React.FC = () => {
  const { login, verifyOtp, generateOtp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { branding } = useBranding();
  const { t } = useLanguage();

  // ── Credentials step (Blank by default - no auto-fill) ─────────────────────
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── OTP step ──────────────────────────────────────────────────────────────
  const [step, setStep]                 = useState<Step>('credentials');
  const [otpEmail, setOtpEmail]         = useState('');
  const [otpCode, setOtpCode]           = useState('');
  const [otpSending, setOtpSending]     = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus OTP input on step change
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 150);
    }
  }, [step]);

  // Listen for force-deactivation event fired by the watchdog in AuthContext
  useEffect(() => {
    const handleDeactivated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setStep('credentials');
      setError(detail?.message || 'Your account has been deactivated. Please contact your administrator.');
    };
    window.addEventListener('account_deactivated', handleDeactivated);
    return () => window.removeEventListener('account_deactivated', handleDeactivated);
  }, []);

  // ─── Step 1: Credentials submit ──────────────────────────────────────────
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const res = await login(cleanEmail, password);
    setLoading(false);

    if (res.result === 'ok') {
      return;
    }
    if (res.result === 'otp_required') {
      setOtpEmail(cleanEmail);
      await handleDispatchOtp(cleanEmail);
      setStep('otp');
      setResendCooldown(60);
      return;
    }
    setError(res.error || 'Login failed.');
  };

  // ─── Dispatch OTP via Email ──────────────────────────────────────────────
  const handleDispatchOtp = async (targetEmail: string) => {
    setOtpSending(true);
    const code = generateOtp(targetEmail);
    try {
      await sendOtpToEmail(targetEmail, code, branding.headerText || 'Bank Recovery System');
    } catch (err) {
      console.warn('Dispatch note:', err);
    } finally {
      setOtpSending(false);
    }
  };

  // ─── Step 2: OTP submit ──────────────────────────────────────────────────
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await verifyOtp(otpEmail, otpCode.trim());
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Invalid verification code.');
      return;
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpSending) return;
    setOtpCode('');
    setError('');
    await handleDispatchOtp(otpEmail);
    setResendCooldown(60);
  };

  const handleBackToLogin = () => {
    setStep('credentials');
    setOtpCode('');
    setError('');
  };

  // ─── UI ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 relative transition-colors duration-300">
      {/* Top right controls */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <LanguageToggle />
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
        >
          {theme === 'dark' ? (
            <span className="inline-flex items-center gap-1.5 text-amber-500">
              <Sun className="w-4 h-4" />
              <span className="hidden sm:inline">{t('top.light_mode', 'Light Mode')}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-indigo-600">
              <Moon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('top.dark_mode', 'Dark Mode')}</span>
            </span>
          )}
        </button>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-2xl mb-4 shadow-xl overflow-hidden">
            {branding.customLogoUrl ? (
              <img src={branding.customLogoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
            ) : (
              <i className={`fa-solid ${branding.logoIcon || 'fa-vault'}`}></i>
            )}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {step === 'otp'
              ? t('login.otp_title', '2-Step Verification')
              : (branding.loginTitle || t('login.signin_title', branding.headerText))}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {step === 'otp'
              ? t('login.otp_subtitle', 'Enter the 6-digit security code sent to your Gmail')
              : (branding.loginSubtitle || t('login.signin_subtitle', branding.underText))}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl transition-colors">

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── STEP 1: Credentials ─────────────────────────────────────── */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  {t('login.email', 'Email Address')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  {t('login.password', 'Password')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-emerald-500" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 text-white dark:text-black font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
              >
                <span>{loading ? t('login.checking', 'Authenticating...') : t('login.submit', 'Sign In')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Security note */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {t('login.security_note', '2-Step Verification protected: A one-time code will be dispatched to your registered Gmail on new login.')}
                </p>
              </div>
            </form>
          )}

          {/* ── STEP 2: OTP Verification ─────────────────────────────────── */}
          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              {/* Sent to indicator */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                      {otpSending ? t('login.otp_sending', 'Dispatching code to Gmail...') : t('login.otp_sent', 'Code Dispatched to Gmail')}
                    </p>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    Sent to <span className="font-semibold text-emerald-700 dark:text-emerald-300 font-mono">{otpEmail}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Check your <strong className="text-slate-600 dark:text-slate-300">Inbox</strong> or <strong className="text-slate-600 dark:text-slate-300">Spam / Junk folder</strong>.
                  </p>
                </div>
              </div>

              {/* OTP Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  {t('login.otp_label', '6-Digit Verification Code')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    ref={otpInputRef}
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xl font-mono font-bold tracking-[0.4em] text-slate-900 dark:text-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-center"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                  <span>{t('login.otp_expires', 'Code is valid for 10 minutes')}</span>
                  <span>{otpCode.length}/6 digits</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full py-2.5 px-4 rounded-xl bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 text-white dark:text-black font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{loading ? t('login.verifying', 'Verifying...') : t('login.verify_otp', 'Verify & Sign In')}</span>
              </button>

              {/* Resend & back */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || otpSending}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:no-underline"
                >
                  <RefreshCw className={`w-3 h-3 ${otpSending ? 'animate-spin' : ''}`} />
                  <span>
                    {otpSending
                      ? 'Sending...'
                      : resendCooldown > 0
                      ? `Resend Code (${resendCooldown}s)`
                      : t('login.resend_otp', 'Resend Code')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium"
                >
                  ← {t('login.back_to_login', 'Back to Login')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400 mt-6">
          {t('login.secure_footer', 'Secured with 2-step email verification • Authorized personnel only')}
        </p>
      </div>
    </div>
  );
};