import { supabase } from '../lib/supabase';

export interface OtpSendResult {
  success: boolean;
  channel?: string;
  supabaseError?: string;
  formFirstActivation?: boolean;
  details?: string[];
}

/**
 * Sends the 6-digit OTP using form-based email relays FIRST (FormSubmit +
 * Web3Forms, fired in parallel). These have no hourly quota like Supabase's
 * built-in auth mailer (which caps at ~2 emails/hour on the free plan).
 *
 * Supabase's native auth OTP is only attempted as a LAST RESORT when both form
 * channels fail, and it's time-boxed so a slow/rejected Supabase call can't
 * hang the login screen.
 */
export async function sendOtpToEmail(targetEmail: string, otpCode: string, systemName = 'Bank & MNC Recovery System'): Promise<OtpSendResult> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  const details: string[] = [];
  let formFirstActivation = false;

  const subject = `🔐 Your Security Verification Code: ${otpCode} - ${systemName}`;
  const body = `Hello,\n\nYour 6-digit verification code to sign into ${systemName} is:\n\n👉  ${otpCode}  👈\n\nThis code is valid for 10 minutes.\nIf you did not request this code, please ignore this email.`;

  // ── Channel A (primary): FormSubmit AJAX — direct to the user's inbox, no hourly cap ──
  // Note: the VERY FIRST email FormSubmit ever sends to an address triggers a one-time
  // activation email; every code after that lands instantly.
  const formSubmit = (async (): Promise<{ ok: boolean; note?: string }> => {
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
      if (res.ok) {
        const data = await res.json().catch(() => null as any);
        // FormSubmit signals first-time activation with success:"false" + message about activation
        if (data && data.success === false) {
          return { ok: false, note: 'FormSubmit first-time activation pending for this address' };
        }
        return { ok: true };
      }
      return { ok: false, note: `FormSubmit HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, note: `FormSubmit: ${err?.message || String(err)}` };
    }
  })();

  // ── Channel B (primary): Web3Forms relay — same code, parallel with FormSubmit ──
  const web3forms = (async (): Promise<{ ok: boolean; note?: string }> => {
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
      if (res.ok) {
        const data = await res.json().catch(() => null as any);
        if (data && data.success === false) {
          return { ok: false, note: `Web3Forms: ${data.message || 'rejected'}` };
        }
        return { ok: true };
      }
      return { ok: false, note: `Web3Forms HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, note: `Web3Forms: ${err?.message || String(err)}` };
    }
  })();

  const [formRes, web3Res] = await Promise.all([formSubmit, web3forms]);
  if (formRes.ok) details.push('FormSubmit ✓');
  else if (formRes.note) details.push(formRes.note);
  if (web3Res.ok) details.push('Web3Forms ✓');
  else if (web3Res.note) details.push(web3Res.note);

  if (formRes.note?.includes('first-time activation')) formFirstActivation = true;

  if (formRes.ok || web3Res.ok) {
    console.log('OTP dispatched via form-based email to:', cleanEmail, details.join(' | '));
    return { success: true, channel: formRes.ok ? 'formsubmit' : 'web3forms', details };
  }

  // ── Channel C (last resort): Supabase native auth OTP — capped at ~2 emails/hour on free plan ──
  // Time-boxed to 6.5s: a rate-limited or hanging Supabase call must not stall the login screen.
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
      console.log('OTP dispatched via Supabase Auth Mailer (fallback) to:', cleanEmail);
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
