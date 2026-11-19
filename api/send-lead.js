// api/send-lead.js — Vercel serverless function for the Palmetto Web Works
// "Plan your site" planner (index.html posts here on submit).
//
// What it does:
//   1. Validates the lead and re-computes the estimate server-side from the
//      price tables below (never trusts the totals the browser sends).
//   2. Emails the full lead to Asim at asiddique@gmail.com, with reply-to
//      set to the visitor so Asim can just hit Reply.
//   3. Sends an instant auto-reply to the visitor.
//
// Setup (one env var in Vercel: Project Settings → Environment Variables):
//   RESEND_API_KEY  — API key from resend.com (free tier, $0).
//   RESEND_FROM     — optional sender, e.g. "Palmetto Web Works
//                     <hello@allmomentumlab.com>". The sending domain must be
//                     verified in Resend first (it asks you to add DNS
//                     records). Default below is hello@allmomentumlab.com.
//   No key is ever hard-coded here. Without RESEND_API_KEY the function
//   answers 503 and the page tells the visitor to use Copy + text instead.

const LEAD_TO = "asiddique@gmail.com";
const FROM = process.env.RESEND_FROM || "Palmetto Web Works <hello@allmomentumlab.com>";

const PKGS = {
  starter: { name: "Starter", price: 300, care: 30 },
  business: { name: "Business", price: 500, care: 30 },
  multi: { name: "Multi-page", price: 800, care: 30 },
};
const ADDS = {
  domain: { name: "Custom domain setup", price: 50 },
  maps: { name: "Google Maps listing", price: 50 },
  page: { name: "Extra page", price: 75 },
  lang: { name: "Second language", price: 100 },
};
const HAVE_LABELS = {
  no: "No, this would be my first",
  yes: "Yes, but it needs a redo",
  fb: "Only a Facebook page",
};
const CARE_LABELS = { month: "a month", year: "a year", none: "none for now" };

const money = (n) => "$" + Number(n).toLocaleString("en-US");
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function sendEmail({ to, subject, text, html, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, text, html, reply_to: replyTo }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend rejected the email (HTTP ${res.status}): ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "Email sending is not set up yet (missing RESEND_API_KEY). Please copy the message and text it to us instead.",
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid request body" });
    }
  }
  body = body || {};

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  const business = String(body.business || "").trim();
  const kind = String(body.kind || "").trim();
  const have = String(body.have || "").trim();
  const notes = String(body.notes || "").trim();
  const pkg = PKGS[body.package] || null;
  const addOns = Array.isArray(body.addOns)
    ? body.addOns.map((id) => ADDS[id]).filter(Boolean)
    : [];
  const care = ["month", "year", "none"].includes(body.care) ? body.care : "month";

  if (!name) return res.status(400).json({ ok: false, error: "Your name is required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ ok: false, error: "A valid email address is required." });
  if (!phone) return res.status(400).json({ ok: false, error: "Your phone number is required." });
  if (!pkg) return res.status(400).json({ ok: false, error: "Please choose a package." });

  // Re-compute the estimate server-side — the same maths as the planner.
  const buildCost = pkg.price + addOns.reduce((s, a) => s + a.price, 0);
  const careCost = care === "month" ? pkg.care : care === "year" ? pkg.care * 10 : 0;
  const careText =
    care === "none" ? "none for now" : `${money(careCost)} ${CARE_LABELS[care]}`;

  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    business ? `Business: ${business}` : null,
    kind ? `Kind of business: ${kind}` : null,
    have ? `Has a website now: ${HAVE_LABELS[have] || have}` : null,
    ``,
    `Package: ${pkg.name} (${money(pkg.price)})`,
    addOns.length
      ? `Add-ons: ${addOns.map((a) => `${a.name} (${money(a.price)})`).join(", ")}`
      : "Add-ons: none",
    `Care plan: ${careText}`,
    `Estimated build (one time): ${money(buildCost)}`,
    `Due to start: ${money(buildCost)}`,
    notes ? `` : null,
    notes ? `Anything else:\n${notes}` : null,
  ].filter((l) => l !== null);

  const leadText = `New website enquiry — Palmetto Web Works\n\n${lines.join("\n")}`;
  const leadHtml = `<h2>New website enquiry</h2><pre style="font-family:inherit;white-space:pre-wrap">${esc(leadText.replace(/^New website enquiry — Palmetto Web Works\n\n/, ""))}</pre>`;

  try {
    await sendEmail({
      to: LEAD_TO,
      replyTo: email,
      subject: `New website enquiry — ${name}${business ? ` (${business})` : ""} · ${pkg.name} ${money(buildCost)}`,
      text: leadText,
      html: leadHtml,
    });
  } catch (err) {
    console.error("send-lead: lead email failed:", err.message);
    return res.status(502).json({
      ok: false,
      error: "We couldn't send your request just now. Please use the Copy message button and text it to us instead.",
    });
  }

  // Auto-reply to the visitor. A failure here must not lose the lead, which
  // is already delivered above — so report it, don't fail the request.
  let autoReply = "sent";
  const replyText =
    `Hi ${name.split(" ")[0] || "there"},\n\n` +
    `Thanks — we've got your website idea. We'll reply with an idea and a price, usually within a day.\n\n` +
    `Your estimate: ${pkg.name} package, ${money(buildCost)} one time` +
    (care === "none" ? ", no care plan for now." : `, plus ${careText} for the care plan.`) +
    `\n\nPrefer to talk first? Just reply to this email, or text us at +1 (803) 386-8526 to book a quick call.\n\n` +
    `— Asim, Palmetto Web Works`;
  try {
    await sendEmail({
      to: email,
      replyTo: LEAD_TO,
      subject: "Thanks — we've got your website idea (Palmetto Web Works)",
      text: replyText,
      html: `<p>${esc(replyText).replace(/\n/g, "<br>")}</p>`,
    });
  } catch (err) {
    console.error("send-lead: auto-reply failed:", err.message);
    autoReply = "failed";
  }

  return res.status(200).json({ ok: true, autoReply });
}
