export interface OtpSendResult {
  success: boolean;
  channel?: string;
  formFirstActivation?: boolean;
  rateLimited?: boolean;
  details?: string[];
}

// ── Web3Forms (PRIMARY) — owner's own fresh access key (Sep 2026) ──────────
// Owner decision: keep Web3Forms as the OTP sender, as configured in v30.
// NOTE: Web3Forms delivers every submission to the INBOX OF THE KEY OWNER —
// it is not per-recipient. FormSubmit (fallback) is the per-recipient channel.
const WEB3FORMS_KEY = '5dc7bd71-6ce3-43fa-9b7a-421b72f0061a';

/**
 * OTP mail delivery (v36) — BOTH channels always run:
 *  1. Web3Forms → administrator-inbox copy. Fast, no activation, no bot-wall,
 *     but NOT per-recipient: the code lands in the key owner's inbox only.
 *     Kept so the administrator can always read a code aloud if an agent's
 *     own mail delivery fails.
 *  2. FormSubmit AJAX → per-recipient copy TO THE AGENT'S OWN ADDRESS. This is
 *     the delivery that matters — overall success is decided by this channel,
 *     because the agent is who must receive the code. Cloudflare may block some
 *     mobile networks and the FIRST email to any address is held until that
 *     address clicks its one-time "Activate FormSubmit" email. Auto-retries
 *     transient "Failed to fetch" once; every failure is surfaced to the login
 *     UI with an actionable message instead of a silent wait.
 */
export async function sendOtpToEmail(targetEmail: string, otpCode: string, systemName = 'Bank & MNC Recovery System'): Promise<OtpSendResult> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  const details: string[] = [];
  let formFirstActivation = false;
  let rateLimited = false;
  let web3ok = false;

  const subject = `🔐 Your Security Verification Code: ${otpCode} - ${systemName}`;
  const body = `Hello,\n\nYour 6-digit verification code to sign into ${systemName} is:\n\n👉  ${otpCode}  👈\n\nThis code is valid for 10 minutes.\nIf you did not request this code, please ignore this email.`;

  // ── Channel 1 (PRIMARY): Web3Forms with the owner's fresh key ──────────────
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
      // Delivered — but only to the key owner's inbox, so keep going: the agent
      // still needs the per-recipient FormSubmit copy below.
      web3ok = true;
      details.push('Web3Forms ✓ (administrator inbox copy)');
    } else if (res.status === 400) {
      details.push('Web3Forms: access key rejected — verify the key is active at web3forms.com');
    } else {
      details.push(`Web3Forms: ${res.ok ? (data?.message || 'rejected') : `HTTP ${res.status}`}`);
    }
  } catch (err: any) {
    details.push(`Web3Forms: ${err?.message || String(err)}`);
  }

  // ── Channel 2 (fallback, per-recipient): FormSubmit AJAX ───────────────────
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
    return { success: true, channel: web3ok ? 'formsubmit+web3forms' : 'formsubmit', details: [...details, 'FormSubmit ✓ (delivered to recipient)'] };
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

  if (web3ok) {
    details.push('Web3Forms ✓ — a copy of this code is in the administrator inbox; ask your admin to read it out if your own mail keeps failing');
  }
  console.warn('OTP send failed:', details.join(' | '));
  return { success: false, formFirstActivation, rateLimited, details };
}
