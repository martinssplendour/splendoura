import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_connect() -> smtplib.SMTP:
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    if not host:
        raise RuntimeError("SMTP_HOST is not configured.")

    if settings.SMTP_USE_SSL:
        context = ssl.create_default_context()
        return smtplib.SMTP_SSL(host, port, context=context, timeout=10)

    server = smtplib.SMTP(host, port, timeout=10)
    if settings.SMTP_USE_TLS:
        context = ssl.create_default_context()
        server.starttls(context=context)
    return server


def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning("SMTP_HOST not configured; skipping email send.")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        with _smtp_connect() as server:
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception:
        logger.exception("Failed to send email to %s", to_email)


def send_password_reset_email(to_email: str, reset_link: str, reset_code: str) -> None:
    subject = "Reset your Splendoure password"
    text_body = (
        "We received a request to reset your password.\n\n"
        f"Reset code: {reset_code}\n"
        f"Reset your password using this link:\n{reset_link}\n\n"
        "If you don't see this email in your inbox within a few minutes, check your spam/junk folder and mark it as Not Spam so the reset link is visible.\n\n"
        "If you did not request this, you can ignore this email."
    )
    html_body = f"""
    <p>We received a request to reset your password.</p>
    <p><strong>Reset code:</strong> {reset_code}</p>
    <p><a href="{reset_link}">Reset your password</a></p>
    <p>If you don't see this email in your inbox within a few minutes, check your spam/junk folder and mark it as Not Spam so the reset link is visible.</p>
    <p>If you did not request this, you can ignore this email.</p>
    """
    send_email(to_email=to_email, subject=subject, html_body=html_body, text_body=text_body)


def send_new_user_alert_email(
    *,
    to_email: str,
    user_id: int,
    full_name: str | None,
    username: str | None,
    joined_email: str,
) -> None:
    display_name = full_name or username or joined_email
    subject = "New user joined Splendoure"
    text_body = (
        "A new user just registered.\n\n"
        f"Name: {display_name}\n"
        f"Email: {joined_email}\n"
        f"Username: {username or '-'}\n"
        f"User ID: {user_id}\n"
    )
    html_body = f"""
    <p>A new user just registered.</p>
    <ul>
      <li><strong>Name:</strong> {display_name}</li>
      <li><strong>Email:</strong> {joined_email}</li>
      <li><strong>Username:</strong> {username or '-'}</li>
      <li><strong>User ID:</strong> {user_id}</li>
    </ul>
    """
    send_email(to_email=to_email, subject=subject, html_body=html_body, text_body=text_body)


