# Mailjet → Supabase Custom SMTP Setup (OTP emails)

This wires your OTP email flow: **app → Supabase Auth → Mailjet SMTP → user's inbox**.
Mailjet free tier = **200 emails/day, 6,000/month**, real SMTP, no bot-walls, no activation emails.

---

## Part 1 — Mailjet account (5 min)

1. Go to **mailjet.com** → **Sign Up** (free, no credit card). Confirm your email.
2. **Verify a sender address** (this is the "From" on every OTP email):
   - Dashboard → gear icon (Account Settings) → **Add a Sender Domain or Address** → **Add a sender address**
   - Use an inbox you control, e.g. `zisanurrahmanbd@gmail.com`
   - Mailjet sends a **validation email** → click the link inside → sender is active.
3. **Get your SMTP credentials**:
   - Account Settings → **SMTP and SEND API Settings**
   - You'll see two strings: **API Key** (public-ish) and **Secret Key** (private)
   - SMTP username = **API Key**, SMTP password = **Secret Key**. Copy both.

## Part 2 — Plug into Supabase (2 min)

1. Supabase Dashboard → your project → **Project Settings → Authentication → SMTP Settings**
2. Toggle **Enable Custom SMTP** and fill:

| Field | Value |
|---|---|
| Sender email | your verified Mailjet sender address |
| Sender name | `RecoveryCORE` |
| Host | `in-v3.mailjet.com` |
| Port number | `587` |
| Username | Mailjet **API Key** |
| Password | Mailjet **Secret Key** |

3. **Save**. (Min interval between emails: leave default, or set 30s.)

## Part 3 — Kill the confirmation-link email (1 min)

- **Authentication → Providers → Email** → **Confirm email = OFF**
- Now a brand-new user gets the **6-digit OTP code** email directly (template contains `{{ .Token }}`), not a link.

## Part 4 — Test

Open a fresh/incognito browser → log in with a user account → the code email arrives
**from your Mailjet sender** within seconds. Enter it in the app — done.
(The app's Web3Forms/FormSubmit channels only fire if Supabase fails, so normally
you'll receive exactly one email.)

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Sender not verified" / SMTP auth failed in Supabase logs | Part 1.2 not completed — validate the sender address |
| Auth failed in Supabase SMTP test | You pasted the account password; must be **API Key / Secret Key** |
| Emails land in Spam | Normal for first days; volume builds reputation. DKIM/SPF on a custom domain fixes it fully |
| Rate limit errors persist | Check Supabase → Logs → Auth; if Mailjet hits 200/day, upgrade or wait for reset |

## Why this architecture

Mailjet's Send API **blocks browser (CORS) calls**, and a browser SPA cannot speak raw
SMTP — so Mailjet cannot be called from the app directly. Supabase Auth already runs
server-side, already mails OTP codes, and this app already verifies those codes natively
(`verifyOtp` in `AuthContext`). Pointing Supabase's custom SMTP at Mailjet gives the
reliability of a real email provider with zero extra moving parts.
