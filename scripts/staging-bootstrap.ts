import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { assertStagingBootstrapEnvironment, bootstrapStaging } from "./staging-bootstrap-lib";

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

async function main(): Promise<void> {
  assertStagingBootstrapEnvironment(process.env);

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const redirectTo = process.env.EMAIL_REDIRECT_TO?.trim();
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });

  try {
    const result = await bootstrapStaging(db, {
      platformAdminEmail: process.env.SEED_PLATFORM_ADMIN_EMAIL!,
      appUrl: process.env.APP_URL!,
      sendPasswordSetLink: async ({ to, resetUrl }) => {
        const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0c1411">
          <h1 style="font-size:22px">Set your Konnekt platform administrator password</h1>
          <p style="font-size:15px;line-height:1.6">Use the link below to choose a password. It expires in 30 minutes and can be used once.</p>
          <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#4F46E5;color:#fff;text-decoration:none">Choose a password</a></p>
          <p style="font-size:13px;color:#5c6b64">If you were not expecting this, ignore the email.</p>
        </body></html>`;
        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: redirectTo || to,
          subject: "Set your Konnekt staging password",
          html,
          text: `Set your Konnekt staging password (expires in 30 minutes): ${resetUrl}`,
        });
        if (error) throw new Error(`Password-set email was not accepted (${error.name}).`);
      },
    });

    console.log(
      `Staging bootstrap complete: university ${result.universityCreated ? "created" : "reused"}, ` +
        `${result.academicNodesCreated} academic nodes created, admin ${result.adminCreated ? "created" : "reused"}, ` +
        `reset link ${result.resetLinkSent ? "sent" : "not sent (already activated)"}.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Staging bootstrap failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
