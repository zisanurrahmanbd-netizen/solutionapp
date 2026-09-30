export interface OtpSendResult {
  success: boolean;
  channel?: string;
  formFirstActivation?: boolean;
  details?: string[];
}

// ── Brevo (PRIMARY) — free transactional email, 300/day, CORS-enabled ──────
// 1. brevo.com → Sign Up free → profile icon → SMTP & API → API Keys → generate.
// 2. Senders & IP → Senders → Add a sender → verify the 6-digit code Brevo emails you.
// 3. Paste BOTH values below and redeploy.
const BREVO_API_KEY = '';           // e.g. 'xkeysib-...'
const BREVO_SENDER_EMAIL = '';      // the VERIFIED sender address from step 2
const BREVO_SENDER_NAME = 'RecoveryCORE';

const brevoConfigured = () => Boolean(BREVO_API_KEY && BREVO_SENDER_EMAIL);

/**
 * OTP mail delivery — own server SMTP first, form relays as fallback.
 *
 * Order:
 *  1. /api/send-otp (this app's own server, Gmail SMTP) → PRIMARY. No third-party
 *     relay, no per-IP bot walls, no activation emails. Env-configured creds.
 *  2. FormSubmit AJAX  → fallback. Flaky on carrier NAT (per-IP rate limit / bot
 *     checks can 429 or block); first email to a new address needs one-time activation.
 *  3. Web3Forms        → last-resort fallback (key may reject depending on usage).
 *
 * Channels run SEQUENTIALLY so a successful send never duplicates emails.
 */
export async function sendOtpToEmail(targetEmail: string, otpCode: string, systemName = 'Bank & MNC Recovery System'): Promise<OtpSendResult> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  const details: string[] = [];
  let formFirstActivation = false;

  const subject = `🔐 Your Security Verification Code: ${otpCode} - ${systemName}`;
  const body = `Hello,\n\nYour 6-digit verification code to sign into ${systemName} is:\n\n👉  ${otpCode}  👈\n\nThis code is valid for 10 minutes.\nIf you did not request this code, please ignore this email.`;

  const htmlContent =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">' +
    `<h2 style="margin:0 0 8px;color:#111827">${systemName}</h2>` +
    '<p style="color:#374151;margin:0 0 16px">Your 6-digit verification code:</p>' +
    `<p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:0 0 16px;color:#111827">${otpCode}</p>` +
    '<p style="color:#6b7280;font-size:13px;margin:0">Valid for 10 minutes. If you did not request this code, please ignore this email.</p></div>';

  // ── Channel 1 (PRIMARY): Brevo transactional API — no relay flakiness, no activation ──
  if (brevoConfigured()) {
    try {
      const controller = new AbortController();
      const kill = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
          to: [{ email: cleanEmail }],
          subject,
          htmlContent,
          textContent: body,
        }),
        signal: controller.signal,
      });
      clearTimeout(kill);
      if (res.ok) {
        console.log('OTP dispatched via Brevo to:', cleanEmail);
        return { success: true, channel: 'brevo', details: ['Brevo ✓'] };
      }
      const errData = await res.json().catch(() => null as any);
      const errMsg = errData?.message || errData?.error || `HTTP ${res.status}`;
      details.push(`Brevo: ${errMsg}`);
    } catch (err: any) {
      details.push(`Brevo: ${err?.name === 'AbortError' ? 'timed out' : (err?.message || 'unreachable')}`);
    }
  } else {
    details.push('Brevo: not configured (needs API key + verified sender)');
  }

  // ── Channel 2 (fallback): FormSubmit AJAX ───────────────────────────────
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

  // ── Channel 3 (last resort): Web3Forms relay ────────────────────────────────
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

  console.warn('All OTP email channels failed:', details.join(' | '));
  return { success: false, formFirstActivation, details };
}
