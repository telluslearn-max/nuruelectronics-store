// One-time provisioning for the NURU WhatsApp Business sender + the two
// Content Templates the app sends (see src/lib/whatsapp-business.ts,
// sendReceiptWhatsApp in src/lib/admin-actions.ts, and the
// /api/cron/whatsapp-review-followup cron).
//
// Prerequisite: an UPGRADED (non-trial) Twilio account — trial accounts can't
// register a production WhatsApp sender. Get TWILIO_ACCOUNT_SID and
// TWILIO_AUTH_TOKEN from console.twilio.com/us1/account/keys-credentials/api-keys
// and put them in .env.local before running any command below.
//
// Usage, in order:
//   node scripts/twilio-whatsapp-setup.mjs register-sender --number +2547XXXXXXXX
//     -> starts registering that number as a WhatsApp sender. Twilio texts an
//        OTP to it — grab the code off that phone.
//   node scripts/twilio-whatsapp-setup.mjs verify-sender --sid <XE...> --code <otp>
//     -> completes registration. Status becomes ONLINE (may pass through
//        TWILIO_REVIEW first — run `status` again in a few minutes if so).
//   node scripts/twilio-whatsapp-setup.mjs set-profile --sid <XE...> --name "NURU Electronics" --about "Order updates from NURU" --website https://www.nuruelectronics.com
//     -> optional but recommended: what customers see in WhatsApp before they
//        accept the chat.
//   node scripts/twilio-whatsapp-setup.mjs status [--sid <XE...>]
//     -> check a sender's status, or list every sender on the account.
//
//   node scripts/twilio-whatsapp-setup.mjs create-receipt-template
//   node scripts/twilio-whatsapp-setup.mjs create-review-template
//     -> create + submit for Meta approval the two templates this app needs.
//        Prints the ContentSid (HX...) to save as TWILIO_WHATSAPP_RECEIPT_TEMPLATE_SID
//        / TWILIO_WHATSAPP_REVIEW_TEMPLATE_SID. Approval typically takes under
//        an hour but can take up to 24h — check with `check-approval`.
//   node scripts/twilio-whatsapp-setup.mjs check-approval --sid <HX...>
//
// Once you have a sender ONLINE and both templates APPROVED, put all five
// vars from .env.local.example's Twilio block in .env.local (and in your
// deploy target's env) and the feature goes live — no code changes needed.
import { config } from "dotenv";
import twilio from "twilio";

config({ path: ".env.local" });

const command = process.argv[2];
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (!accountSid || !(authToken || (apiKeySid && apiKeySecret))) {
  console.error(
    "Set TWILIO_ACCOUNT_SID in .env.local, plus either TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET " +
      "(Console > Account > API keys & tokens).",
  );
  process.exit(1);
}

const client = apiKeySid && apiKeySecret ? twilio(apiKeySid, apiKeySecret, { accountSid }) : twilio(accountSid, authToken);

// Matches the "1"/"2"/"3"/"4" contentVariables sent by sendReceiptWhatsApp
// in src/lib/admin-actions.ts — keep in sync if that call site changes.
const RECEIPT_TEMPLATE_BODY =
  "Hi {{1}}, thanks for your purchase! Your NURU receipt {{2}} for {{3}} is ready. " +
  "View your documents any time: {{4}}";

// Matches the "1"/"2" contentVariables sent by the whatsapp-review-followup
// cron in src/app/api/cron/whatsapp-review-followup/route.ts.
const REVIEW_TEMPLATE_BODY =
  "Hi {{1}}, it's been two weeks since your {{2}} arrived from NURU. How's it working out? " +
  "We'd love a quick review if you have a moment.";

async function createAndSubmitTemplate(friendlyName, body, category) {
  const template = await client.content.v1.contents.create({
    friendlyName,
    language: "en",
    types: { "twilio/text": { body } },
  });
  console.log(`Created template "${friendlyName}" — ContentSid: ${template.sid}`);

  const approval = await client.content.v1.contents(template.sid).approvalCreate.create({ name: friendlyName, category });
  console.log(`Submitted for ${category} approval — status: ${approval.status}`);
  console.log(`\nSave this once approved:\n  ${envVarFor(category)}=${template.sid}`);
  return template.sid;
}

function envVarFor(category) {
  return category === "UTILITY" ? "TWILIO_WHATSAPP_RECEIPT_TEMPLATE_SID" : "TWILIO_WHATSAPP_REVIEW_TEMPLATE_SID";
}

if (command === "register-sender") {
  const number = flag("number");
  if (!number) {
    console.error("Usage: node scripts/twilio-whatsapp-setup.mjs register-sender --number +2547XXXXXXXX");
    process.exit(1);
  }
  const senderId = number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
  const sender = await client.messaging.v2.channelsSenders.create({
    senderId,
    configuration: { verificationMethod: "sms" },
  });
  console.log(`Registration started. Sender SID: ${sender.sid} — status: ${sender.status}`);
  console.log(`Twilio just texted an OTP to ${number} — run:`);
  console.log(`  node scripts/twilio-whatsapp-setup.mjs verify-sender --sid ${sender.sid} --code <the code>`);
} else if (command === "verify-sender") {
  const sid = flag("sid");
  const code = flag("code");
  if (!sid || !code) {
    console.error("Usage: node scripts/twilio-whatsapp-setup.mjs verify-sender --sid <XE...> --code <otp>");
    process.exit(1);
  }
  const sender = await client.messaging.v2.channelsSenders(sid).update({ configuration: { verificationCode: code } });
  console.log(`Status: ${sender.status}`);
  if (sender.status === "ONLINE") {
    console.log(`\nSave this:\n  TWILIO_WHATSAPP_FROM=${sender.senderId}`);
  } else {
    console.log("Not ONLINE yet — run `status --sid " + sid + "` again shortly (may sit in TWILIO_REVIEW for a bit).");
  }
} else if (command === "set-profile") {
  const sid = flag("sid");
  if (!sid) {
    console.error("Usage: node scripts/twilio-whatsapp-setup.mjs set-profile --sid <XE...> [--name] [--about] [--website] [--logo-url]");
    process.exit(1);
  }
  const profile = {};
  if (flag("name")) profile.name = flag("name");
  if (flag("about")) profile.about = flag("about");
  if (flag("website")) profile.websites = [flag("website")];
  if (flag("logo-url")) profile.logoUrl = flag("logo-url");
  const sender = await client.messaging.v2.channelsSenders(sid).update({ profile });
  console.log(`Updated profile for ${sender.senderId}.`);
} else if (command === "status") {
  const sid = flag("sid");
  if (sid) {
    const sender = await client.messaging.v2.channelsSenders(sid).fetch();
    console.log(sender.senderId, "-", sender.status, sender.offlineReasons?.length ? sender.offlineReasons : "");
  } else {
    const senders = await client.messaging.v2.channelsSenders.list({ channel: "whatsapp" });
    if (senders.length === 0) console.log("No WhatsApp senders registered yet.");
    senders.forEach((s) => console.log(s.sid, s.senderId, "-", s.status));
  }
} else if (command === "create-receipt-template") {
  await createAndSubmitTemplate("nuru_whatsapp_receipt", RECEIPT_TEMPLATE_BODY, "UTILITY");
} else if (command === "create-review-template") {
  await createAndSubmitTemplate("nuru_whatsapp_review_followup", REVIEW_TEMPLATE_BODY, "MARKETING");
} else if (command === "check-approval") {
  const sid = flag("sid");
  if (!sid) {
    console.error("Usage: node scripts/twilio-whatsapp-setup.mjs check-approval --sid <HX...>");
    process.exit(1);
  }
  const content = await client.content.v1.contents(sid).approvalFetch.fetch();
  console.log(`Approval info:`, JSON.stringify(content.whatsapp, null, 2));
} else {
  console.log(
    "Usage: node scripts/twilio-whatsapp-setup.mjs <register-sender|verify-sender|set-profile|status|create-receipt-template|create-review-template|check-approval> [flags]",
  );
  process.exit(1);
}
