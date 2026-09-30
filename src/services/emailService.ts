import { supabase } from '../lib/supabase';

export interface OtpSendResult {
  success: boolean;
  channel?: string;
  supabaseError?: string;
  formFirstActivation?: boolean;
  details?: string[];
}

/**
 * OTP mail delivery — FormSubmit FIRST (the user's chosen provider).
 *
 * Order:
 *  1. FormSubmit AJAX  → the one and only primary channel. No hourly quota.
 *     Note: the very first email FormSubmit ever sends to an address triggers a
 *     one-time "Activate" email; after that, every code lands instantly.
 *  2. Web3Forms        → only if FormSubmit fails outright (network/HTTP error).
 *  3. Supabase auth OTP→ last resort only, time-boxed to 6.5s. Rate-limited to
 *     ~2 emails/hour on the free plan, so it must never be depended on.
 *
 * Channels run SEQUENTIALLY (not parallel) so a successful FormSubmit send never
 * produces a duplicate second email.
 */
export async function sendOtpToEmail(targetEmail: string, otpCode: string, systemName = 'Bank & MNC Recovery System'): Promise<OtpSendResult> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  const details: string[] = [];
  let formFirstActivation = false;

  const subject = `🔐 Your Security Verification Code: ${otpCode} - ${systemName}`;
  const body = `Hello,\n\nYour 6-digit verification code to sign into ${systemName} is:\n\n👉  ${otpCode}  👈\n\nThis code is valid for 10 minutes.\nIf you did not request this code, please ignore this email.`;

  // ── Channel 1 (PRIMARY): FormSubmit AJAX ────────────────────────────────────
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(cleanEmail)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        System: systemName,
        Recipient: cleanEmail,
        Security_Code: otpCode,
        Valid_For: '10 Minutes',
        Message: `Use the 6-digit verification code: ${otpCode} to complete your 2-step login.`
      })
    });

    const data = res.ok ? await res.json().catch(() => null as any) : null;
    const saysSuccess = data?.success === true || data?.success === 'true';
    const saysActivation = typeof data?.message === 'string' && data.message.toLowerCase().includes('activation');

    if (res.ok && saysSuccess) {
      console.log('OTP dispatched via FormSubmit to:', cleanEmail);
      return { success: true, channel: 'formsubmit', details: ['FormSubmit ✓'] };
    }

    if (res.ok && saysActivation) {
      // FormSubmit accepted the request but this address needs one-time activation.
      formFirstActivation = true;
      details.push('FormSubmit: first-time activation email sent for this address');
    } else if (res.ok) {
      details.push(`FormSubmit: unexpected reply (${(data?.message || 'no message').slice(0, 60)})`);
    } else {
      details.push(`FormSubmit HTTP ${res.status}`);
    }
  } catch (err: any) {
    details.push(`FormSubmit: ${err?.message || String(err)}`);
  }

  // ── Channel 2 (fallback): Web3Forms relay ───────────────────────────────────
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        access_key: '67c87c46-f94d-4952-bfb8-9366f075d71c',
        subject,
        from_name: systemName,
        email: cleanEmail,
        to_email: cleanEmail,
        message: body,
      })
    });

    const data = res.ok ? await res.json().catch(() => null as any) : null;
    if (res.ok && data?.success === true) {
      console.log('OTP dispatched via Web3Forms to:', cleanEmail);
      return { success: true, channel: 'web3forms', details: [...details, 'Web3Forms ✓'] };
    }
    details.push(`Web3Forms: ${res.ok ? (data?.message || 'rejected') : `HTTP ${res.status}`}`);
  } catch (err: any) {
    details.push(`Web3Forms: ${err?.message || String(err)}`);
  }

  // ── Channel 3 (last resort): Supabase native auth OTP ───────────────────────
  let supabaseError: string | undefined;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase request timed out')), 6500)
    );
    const call = supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.protocol}//${window.location.host}/`,
      }
    });
    const { error } = await Promise.race([call, timeout]);
    if (!error) {
      console.log('OTP dispatched via Supabase Auth Mailer (last resort) to:', cleanEmail);
      return { success: true, channel: 'supabase', details: [...details, 'Supabase ✓'] };
    }
    supabaseError = error.message;
    details.push(`Supabase: ${error.message}`);
  } catch (err: any) {
    supabaseError = err?.message || String(err);
    details.push(`Supabase: ${supabaseError}`);
  }

  console.warn('All OTP email channels failed:', details.join(' | '));
  return { success: false, supabaseError, formFirstActivation, details };
}
