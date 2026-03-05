import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def send_email(to: str, subject: str, html: str) -> bool:
    if not _is_configured():
        logger.warning(f"[EMAIL-NOOP] To={to} | Subject={subject} — configure SMTP_* vars in .env")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], to, msg.as_string())
        logger.info(f"[EMAIL-SENT] To={to} | Subject={subject}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL-ERROR] {e}")
        return False


def _base(content: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#07070f;font-family:'Helvetica Neue',sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#0f0f1a;border:1px solid #1e1e2e;
              border-radius:16px;padding:40px 32px;color:#fff">
    <div style="margin-bottom:24px">
      <span style="background:#3b5bdb;color:#fff;font-weight:700;font-size:14px;
                   padding:6px 14px;border-radius:8px;letter-spacing:.5px">TURION</span>
    </div>
    {content}
    <hr style="border:none;border-top:1px solid #1e1e2e;margin:32px 0">
    <p style="color:#444;font-size:11px;margin:0">
      Turion Network · turion.network<br>
      If you did not request this, please ignore this email.
    </p>
  </div>
</body>
</html>"""


def send_password_reset(to: str, name: str, token: str) -> bool:
    link = f"https://turion.network/reset-password?token={token}"
    html = _base(f"""
      <h2 style="margin:0 0 8px;font-size:22px">Reset your password</h2>
      <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 28px">
        Hi {name}, we received a request to reset your password.<br>
        This link expires in <strong style="color:#fff">1 hour</strong>.
      </p>
      <a href="{link}"
         style="display:inline-block;background:#3b5bdb;color:#fff;padding:13px 28px;
                border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
        Reset Password →
      </a>
    """)
    return send_email(to, "Reset your Turion Network password", html)


def send_verification(to: str, name: str, token: str) -> bool:
    link = f"https://turion.network/verify-email?token={token}"
    html = _base(f"""
      <h2 style="margin:0 0 8px;font-size:22px">Verify your email</h2>
      <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 28px">
        Welcome to Turion Network, {name}!<br>
        Please verify your email address to unlock all features.<br>
        This link expires in <strong style="color:#fff">24 hours</strong>.
      </p>
      <a href="{link}"
         style="display:inline-block;background:#3b5bdb;color:#fff;padding:13px 28px;
                border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
        Verify Email →
      </a>
    """)
    return send_email(to, "Verify your Turion Network email", html)
