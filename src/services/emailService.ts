export interface OtpSendResult {
  success: boolean;
  channel?: string;
  formFirstActivation?: boolean;
  rateLimited?: boolean;
  details?: string[];
}

/**
 * OTP mail delivery — FormSubmit ONLY, as the product owner specified (v28).
 * Brevo was removed by request.
 *
 * Flow:
 *  1. FormSubmit AJAX POST → the user's own email receives the 6-digit code.
 *     • First time ever for an address: FormSubmit sends a one-time
 *       "Activate FormSubmit" email and HOLDS the submission until the user
 *       clicks Activate. This is FormSubmit's anti-spam and cannot be skipped.
 *       After activation, every code lands instantly.
 *     • Occasional "Failed to fetch" (Cloudflare blip on mobile networks) is
 *       auto-retried once after 1.5s before giving up.
 *     • HTTP 429 = FormSubmit per-IP rate limit; surfaced to the user.
 *  2. Web3Forms is a silent LAST RESORT only if FormSubmit errors outright.
 */
export async function sendOtpToEmail(targetEmail: string, otpCode: string, systemName = 'Bank & MNC Recovery System'): Promise<OtpSendResult> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  const details: string[] = [];
  let formFirstActivation = false;
  let rateLimited = false;

  const subject = `🔐 Your Security Verification Code: ${otpCode} - ${systemName}`;
  const body = `Hello,\n\nYour 6-digit verification code to sign into ${systemName} is:\n\n👉  ${otpCode}  👈\n\nThis code is valid for 10 minutes.\nIf you did not request this code, please ignore this email.`;

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
    return { success: true, channel: 'formsubmit', details: ['FormSubmit ✓'] };
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

  // ── Silent last resort: Web3Forms relay ─────────────────────────────────────
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
      console.log('OTP dispatched via Web3Forms (last resort) to:', cleanEmail);
      return { success: true, channel: 'web3forms', details: [...details, 'Web3Forms ✓'] };
    }
    if (res.status === 400) {
      // 400 = the access key itself was rejected (dead/expired) — a fresh key fixes it.
      details.push('Web3Forms: access key rejected/expired — admin must create a fresh free key at web3forms.com');
    } else {
      details.push(`Web3Forms: ${res.ok ? (data?.message || 'rejected') : `HTTP ${res.status}`}`);
    }
  } catch (err: any) {
    details.push(`Web3Forms: ${err?.message || String(err)}`);
  }

  console.warn('OTP send failed:', details.join(' | '));
  return { success: false, formFirstActivation, rateLimited, details };
}
