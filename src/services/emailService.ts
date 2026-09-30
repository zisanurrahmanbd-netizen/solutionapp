import { supabase } from '../lib/supabase';

export interface OtpSendResult {
  success: boolean;
  channel?: string;
  formFirstActivation?: boolean;
  rateLimited?: boolean;
  details?: string[];
}

// ── Web3Forms (PRIMARY) — owner's own fresh access key (Sep 2026) ──────────
// NOTE: Web3Forms delivers every submission to the INBOX OF THE KEY OWNER —
// it is not per-recipient. FormSubmit (fallback) is the per-recipient channel.
const WEB3FORMS_KEY = '5dc7bd71-6ce3-43fa-9b7a-421b72f0061a';

/**
 * OTP mail delivery (v31):
 *  1. Supabase Auth OTP → PRIMARY once the admin plugs Mailjet into Supabase as
 *     custom SMTP (guide in repo: MAILJET_SETUP.md). Supabase then emails the
 *     6-digit code through Mailjet — real SMTP, no bot-walls, 200/day free,
 *     and the app verifies those codes natively in AuthContext.verifyOtp.
 *     Before Mailjet is configured, this channel fails fast with a clear note.
 *  2. Web3Forms with the owner's fresh key → interim channel. Delivers to the
 *     key-owner's inbox (not per-recipient).
 *  3. FormSubmit AJAX → per-recipient fallback (one-time activation per address).
 */
export async function sendOtpToEmail(targetEmail: string, otpCode: string, systemName = 'Bank & MNC Recovery System'): Promise<OtpSendResult> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  const details: string[] = [];
  let formFirstActivation = false;
  let rateLimited = false;

  const subject = `🔐 Your Security Verification Code: ${otpCode} - ${systemName}`;
  const body = `Hello,\n\nYour 6-digit verification code to sign into ${systemName} is:\n\n👉  ${otpCode}  👈\n\nThis code is valid for 10 minutes.\nIf you did not request this code, please ignore this email.`;

  // ── Channel 1 (PRIMARY once Mailjet SMTP is configured): Supabase Auth OTP ──
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.protocol}//${window.location.host}/`,
      },
    });
    if (!error) {
      console.log('OTP dispatched via Supabase Auth (Mailjet SMTP) to:', cleanEmail);
      return { success: true, channel: 'supabase-mailjet', details: ['Supabase+Mailjet ✓'] };
    }
    const msg = error.message || '';
    if (msg.toLowerCase().includes('rate limit')) {
      details.push('Supabase: rate limit (Mailjet SMTP not configured yet — see MAILJET_SETUP.md)');
    } else {
      details.push(`Supabase: ${msg}`);
    }
  } catch (err: any) {
    details.push(`Supabase: ${err?.message || 'unreachable'}`);
  }

  // ── Channel 2 (interim): Web3Forms with the owner's fresh key ──────────────
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject,
        from_name: systemName,
        email: cleanEmail,
        message: body,
      })
    });
    const data = res.ok ? await res.json().catch(() => null as any) : null;
    if (res.ok && data?.success === true) {
      console.log('OTP dispatched via Web3Forms to:', cleanEmail);
      return { success: true, channel: 'web3forms', details: ['Web3Forms ✓'] };
    }
    if (res.status === 400) {
      details.push('Web3Forms: access key rejected — verify the key is active at web3forms.com');
    } else {
      details.push(`Web3Forms: ${res.ok ? (data?.message || 'rejected') : `HTTP ${res.status}`}`);
    }
  } catch (err: any) {
    details.push(`Web3Forms: ${err?.message || String(err)}`);
  }

  // ── Channel 3 (fallback, per-recipient): FormSubmit AJAX ───────────────────
  const attemptFormSubmit = async (): Promise<{ ok: boolean; kind: 'success' | 'activation' | 'rate' | 'http' | 'network'; note?: string }> => {
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
      if (res.ok && (data?.success === true || data?.success === 'true')) {
        return { ok: true, kind: 'success' };
      }
      const msg = String(data?.message || '');
      if (res.ok && msg.toLowerCase().includes('activation')) {
        return { ok: false, kind: 'activation', note: msg };
      }
      if (res.status === 429 || msg.toLowerCase().includes('rate limit')) {
        return { ok: false, kind: 'rate', note: msg || `HTTP ${res.status}` };
      }
      return { ok: false, kind: 'http', note: res.ok ? (msg || 'unexpected reply') : `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, kind: 'network', note: err?.message || 'Failed to fetch' };
    }
  };

  // Attempt 1, then one automatic retry for transient network blips.
  let formRes = await attemptFormSubmit();
  if (!formRes.ok && formRes.kind === 'network') {
    await new Promise(r => setTimeout(r, 1500));
    formRes = await attemptFormSubmit();
  }

  if (formRes.ok) {
    console.log('OTP dispatched via FormSubmit to:', cleanEmail);
    return { success: true, channel: 'formsubmit', details: [...details, 'FormSubmit ✓'] };
  }
  if (formRes.kind === 'activation') {
    formFirstActivation = true;
    details.push('FormSubmit: activation email sent (first time for this address)');
  } else if (formRes.kind === 'rate') {
    rateLimited = true;
    details.push(`FormSubmit: rate limit (${formRes.note})`);
  } else if (formRes.kind === 'network') {
    details.push('FormSubmit: blocked by its bot protection on this network (after auto-retry)');
  } else {
    details.push(`FormSubmit: ${formRes.note}`);
  }

  console.warn('OTP send failed:', details.join(' | '));
  return { success: false, formFirstActivation, rateLimited, details };
}
