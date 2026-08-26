import { sendTransactionalEmail, emailConfigured } from "@/lib/email/resend";

async function main() {
  const to = process.argv[2]?.trim();
  if (!to) {
    console.error("Usage: npm run test:email -- recipient@example.com");
    process.exit(1);
  }

  if (!emailConfigured()) {
    console.error("Set RESEND_API_KEY or MAILCHANNELS_API_KEY in .env first.");
    process.exit(1);
  }

  const result = await sendTransactionalEmail({
    to,
    subject: "Elorakart email test",
    text: "If you received this, transactional email is working.",
    html: "<p>If you received this, <strong>transactional email</strong> is working.</p>",
  });

  console.log(result);
  if ("skipped" in result && result.skipped) process.exit(1);
  if ("ok" in result && result.ok === false) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
