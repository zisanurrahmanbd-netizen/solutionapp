export interface OtpSendResult {
  success: boolean;
  channel?: string;
  formFirstActivation?: boolean;
  details?: string[];
}

/**
 * OTP mail delivery — form-based only. Supabase Auth is NEVER called to send
 * email: its built-in mailer is rate-limited (~2/hour on the free plan) and,
 * with "Confirm email" enabled, sends a confirmation LINK instead of a code —
 * which confused users. Removed entirely in v26.
 *
 * Order:
 *  1. FormSubmit AJAX  → primary channel. No hourly quota.
 *     Note: the very first email FormSubmit ever sends to an address triggers a
 *     one-time "Activate" email; after that, every code lands instantly.
 *  2. Web3Forms        → only if FormSubmit fails outright (network/HTTP error).
 *
 * Channels run SEQUENTIALLY (not parallel) so a successful FormSubmit send never
 * produces a duplicate second email. If both fail, the login screen shows the
 * per-channel errors and a Resend Code button.
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

  console.warn('All OTP email channels failed:', details.join(' | '));
  return { success: false, formFirstActivation, details };
}
