import os
import re
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify

app = Flask(__name__)

# ── SMTP configuration (set in hosting environment, never in code) ──────────
# SMTP_HOST / SMTP_PORT have sane Gmail defaults; SMTP_USER and SMTP_PASS are
# required secrets supplied by the admin (Gmail app password).
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "") or SMTP_USER

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Soft in-memory rate limit: one code per address per 45 seconds (per instance)
_last_send = {}

CORS_ORIGINS = (
    "https://solution.freebuff.app",
    "https://zisanurrahmanbd-netizen.github.io",
    "http://localhost:3000",
    "http://localhost:5173",
)


def _cors(resp):
    origin = request.headers.get("Origin", "")
    if origin in CORS_ORIGINS or origin.endswith(".freebuff.app"):
        resp.headers["Access-Control-Allow-Origin"] = origin
    else:
        resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Max-Age"] = "86400"
    return resp


@app.route("/api/send-otp", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return _cors(app.response_class(status=204))
    return _cors(jsonify({
        "ok": True,
        "service": "send-otp",
        "smtpConfigured": bool(SMTP_USER and SMTP_PASS),
    }))


@app.route("/api/send-otp", methods=["POST"])
def send_otp():
    try:
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        code = str(data.get("code") or "").strip()
        system = (data.get("system") or "RecoveryCORE").strip()[:60]

        if not EMAIL_RE.match(email):
            return _cors(jsonify({"success": False, "error": "Invalid email address"})), 400
        if not re.fullmatch(r"\d{4,8}", code):
            return _cors(jsonify({"success": False, "error": "Invalid code format"})), 400
        if not (SMTP_USER and SMTP_PASS):
            return _cors(jsonify({
                "success": False,
                "error": "SMTP not configured on the server. The admin must set SMTP_USER and SMTP_PASS in the hosting environment.",
            })), 503

        now = time.time()
        if now - _last_send.get(email, 0) < 45:
            return _cors(jsonify({
                "success": False,
                "error": "Please wait a few seconds before requesting another code.",
            })), 429
        _last_send[email] = now

        subject = "🔐 Your Security Verification Code: {0} - {1}".format(code, system)
        text = (
            "Hello,\n\nYour 6-digit verification code to sign into {0} is:\n\n"
            "👉  {1}  👈\n\nThis code is valid for 10 minutes.\n"
            "If you did not request this code, please ignore this email."
        ).format(system, code)
        html = (
            '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;'
            'padding:24px;border:1px solid #e5e7eb;border-radius:12px">'
            '<h2 style="margin:0 0 8px;color:#111827">{0}</h2>'
            '<p style="color:#374151;margin:0 0 16px">Your 6-digit verification code:</p>'
            '<p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:0 0 16px;color:#111827">{1}</p>'
            '<p style="color:#6b7280;font-size:13px;margin:0">Valid for 10 minutes. '
            'If you did not request this code, please ignore this email.</p></div>'
        ).format(system, code)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = email
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [email], msg.as_string())

        return _cors(jsonify({"success": True, "channel": "smtp"}))
    except smtplib.SMTPAuthenticationError:
        return _cors(jsonify({
            "success": False,
            "error": "SMTP authentication failed — check SMTP_USER / SMTP_PASS.",
        })), 502
    except Exception as exc:
        return _cors(jsonify({"success": False, "error": str(exc)[:140]})), 502
