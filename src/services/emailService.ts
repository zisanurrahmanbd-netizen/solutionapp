import { supabase } from '../lib/supabase';

export async function sendOtpToEmail(targetEmail: string, otpCode: string, systemName = 'Bank & MNC Recovery System'): Promise<{ success: boolean; channel?: string }> {
  let sent = false;
  const cleanEmail = targetEmail.trim().toLowerCase();

  // ── Channel 1: Supabase Native Auth OTP (Instant Official Email) ─────────────
  // Setting shouldCreateUser: true allows Supabase to dispatch the 6-digit OTP to any user immediately
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      }
    });
    if (!error) {
      console.log('OTP dispatched via Supabase Auth Mailer to:', cleanEmail);
      sent = true;
    } else {
      console.warn('Supabase Auth OTP dispatch notice:', error.message);
    }
  } catch (err) {
    console.warn('Supabase Auth OTP dispatch catch:', err);
  }

  // ── Channel 2: Web3Forms Instant Direct Dispatch (Zero activation needed) ─────
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        access_key: '67c87c46-f94d-4952-bfb8-9366f075d71c',
        subject: `🔐 Your Security Verification Code: ${otpCode} - ${systemName}`,
        from_name: systemName,
        email: cleanEmail,
        to_email: cleanEmail,
        message: `Hello,\n\nYour 6-digit verification code to sign into ${systemName} is:\n\n👉  ${otpCode}  👈\n\nThis code is valid for 10 minutes.\nIf you did not request this code, please ignore this email.`,
      })
    });
    if (res.ok) {
      console.log('OTP dispatched via Web3Forms Mailer');
      sent = true;
    }
  } catch (err) {
    console.warn('Web3Forms dispatch note:', err);
  }

  // ── Channel 3: FormSubmit Direct Token Dispatch ─────────────────────────────
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(cleanEmail)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: `🔐 Your Login Verification Code: ${otpCode} - ${systemName}`,
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
      sent = true;
    }
  } catch (err) {
    console.warn('FormSubmit note:', err);
  }

  return { success: sent, channel: sent ? 'email' : 'pending' };
}