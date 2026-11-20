import "server-only";
import { Resend } from "resend";
import { env, hasResend, isProduction } from "@/lib/env";

/**
 * Transactional email. Resend in every deployed environment. Without an API
 * key (local dev and automated tests) messages are captured by an in-process
 * outbox so flows remain fully exercisable; production env validation makes
 * that path unreachable.
 */
export interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  createdAt: Date;
  code?: string;
}

const globalOutbox = globalThis as unknown as { konnektOutbox?: OutboxMessage[] };
const outbox = (globalOutbox.konnektOutbox ??= []);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${(local ?? "").slice(0, 1)}***@${domain}`;
}

let resend: Resend | null = null;

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  code?: string;
}

async function deliver(mail: Mail): Promise<void> {
  const to = env.EMAIL_REDIRECT_TO ?? mail.to;

  // Capture first so tests and local flows can read the code even when Resend
  // is configured with a redirect address.
  outbox.unshift({ to: mail.to, subject: mail.subject, text: mail.text, createdAt: new Date(), code: mail.code });
  if (outbox.length > 50) outbox.length = 50;

  if (!hasResend) {
    if (isProduction) throw new Error("RESEND_API_KEY is not configured");
    console.info(`[email:dev] ${mail.subject} → ${maskEmail(mail.to)}`);
    return;
  }

  resend ??= new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: { "X-Entity-Ref-ID": `konnekt-${Date.now()}` },
  });
  if (error) {
    console.error(`[email] delivery failed for ${maskEmail(mail.to)}: ${error.name}`);
    throw new Error("Email delivery failed");
  }
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0c1411;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e8e5;border-radius:16px;padding:28px;">
<tr><td style="font-size:20px;font-weight:700;letter-spacing:-0.02em;padding-bottom:20px;">Konnekt</td></tr>
<tr><td><h1 style="font-size:22px;line-height:1.25;margin:0 0 12px;">${escapeHtml(heading)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;line-height:1.5;color:#5c6b64;">Konnekt — verified students, one campus at a time.<br>You are receiving this because someone used this address on Konnekt. If that was not you, ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
}

const paragraph = (text: string) =>
  `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#26332c;">${escapeHtml(text)}</p>`;

export async function sendVerificationCode(
  to: string,
  code: string,
  purpose: "SIGNUP_EMAIL" | "PASSWORD_RESET" | "STUDENT_EMAIL",
): Promise<void> {
  const titles = {
    SIGNUP_EMAIL: "Confirm your email",
    STUDENT_EMAIL: "Confirm your student email",
    PASSWORD_RESET: "Reset your password",
  } as const;
  const subject =
    purpose === "STUDENT_EMAIL"
      ? "Your Konnekt student verification code"
      : purpose === "PASSWORD_RESET"
        ? "Your Konnekt password reset code"
        : "Your Konnekt confirmation code";
  const intro =
    purpose === "STUDENT_EMAIL"
      ? "Enter this code to verify you are a student. It expires in 10 minutes."
      : purpose === "PASSWORD_RESET"
        ? "Enter this code to reset your password. It expires in 10 minutes."
        : "Enter this code to finish creating your Konnekt account. It expires in 10 minutes.";
  const html = layout(
    titles[purpose],
    `${paragraph(intro)}
     <div style="font-size:34px;font-weight:700;letter-spacing:10px;padding:16px;background:#f2f7f4;border:1px solid #dde7e1;border-radius:12px;text-align:center;margin:0 0 16px;">${escapeHtml(code)}</div>
     ${paragraph("Never share this code. Konnekt will never ask you for it.")}`,
  );
  await deliver({ to, subject, html, text: `${intro}\n\n${code}\n\nNever share this code.`, code });
}

export async function sendVerificationDecision(
  to: string,
  input: { approved: boolean; reasonLabel?: string; note?: string; shortName: string },
): Promise<void> {
  const heading = input.approved ? "You're verified 🎉" : "We couldn't verify your student status";
  const body = input.approved
    ? `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#26332c;">Your student status at ${escapeHtml(input.shortName)} is confirmed. Open Konnekt to finish your profile and meet your campus.</p>`
    : `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#26332c;">Your verification for ${escapeHtml(input.shortName)} was not approved.</p>
       <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#26332c;"><strong>Reason:</strong> ${escapeHtml(input.reasonLabel ?? "Not specified")}</p>
       ${input.note ? `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#26332c;">${escapeHtml(input.note)}</p>` : ""}
       <p style="font-size:15px;line-height:1.6;margin:0;color:#26332c;">You can resubmit with a clearer document from the app. You have 3 attempts every 24 hours.</p>`;
  await deliver({
    to,
    subject: input.approved ? "You're verified on Konnekt" : "Your Konnekt verification was not approved",
    html: layout(heading, body),
    text: input.approved
      ? `Your student status at ${input.shortName} is confirmed.`
      : `Your verification was not approved. Reason: ${input.reasonLabel ?? "Not specified"}. ${input.note ?? ""}`,
  });
}

export async function sendVouchRequest(
  to: string,
  input: { studentName: string; studentUsername: string; shortName: string },
): Promise<void> {
  await deliver({
    to,
    subject: `${input.studentName} asked you to vouch for them on Konnekt`,
    html: layout(
      "A student needs your vouch",
      `${paragraph(`${input.studentName} (@${input.studentUsername}) says they are a student at ${input.shortName} and asked you to vouch for them.`)}
       ${paragraph("Open the verification queue in Konnekt to confirm their details, or decline if you cannot.")}`,
    ),
    text: `${input.studentName} (@${input.studentUsername}) asked you to vouch for them at ${input.shortName}. Open the verification queue in Konnekt to respond.`,
  });
}

export async function sendPasswordResetLink(to: string, url: string): Promise<void> {
  await deliver({
    to,
    subject: "Reset your Konnekt password",
    html: layout(
      "Reset your password",
      `${paragraph("Use the button below to choose a new password. The link works once and expires in 30 minutes.")}
       <p style="margin:0 0 20px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0c1411;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:12px;">Reset password</a></p>
       ${paragraph("If you did not ask for this, you can ignore this email — your password will not change.")}`,
    ),
    text: `Reset your Konnekt password (single use, expires in 30 minutes): ${url}`,
  });
}

export async function sendUniversityInvite(
  to: string,
  input: { universityName: string; roleLabel: string; url: string },
): Promise<void> {
  await deliver({
    to,
    subject: `You've been invited to manage ${input.universityName} on Konnekt`,
    html: layout(
      "You've been invited",
      `${paragraph(`You have been invited as ${input.roleLabel} for ${input.universityName} on Konnekt. Create your account to start.`)}
       <p style="margin:0 0 20px;"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#0c1411;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:12px;">Open invite</a></p>`,
    ),
    text: `You have been invited as ${input.roleLabel} for ${input.universityName}. ${input.url}`,
  });
}

/** Test-only accessor. Never reachable in production (see /api/dev/last-email). */
export function lastOutboxMessage(email?: string): OutboxMessage | undefined {
  if (email) {
    const normalized = email.toLowerCase();
    return outbox.find((message) => message.to.toLowerCase() === normalized);
  }
  return outbox[0];
}
