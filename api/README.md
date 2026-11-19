# Palmetto Web Works

Fast, phone-friendly websites for local South Carolina businesses. Static
site (`index.html` + `images/`), served by Vercel. Pricing: Starter $300,
Business $500 (most popular), Multi-page $800; care plan $30/month or
$300/year; add-ons: custom domain $50, Google Maps listing $50, extra page
$75, second language $100.

## The planner form — how leads work now

The "Plan your site" planner is a real form. On submit it POSTs to
`api/send-lead.js` (a Vercel serverless function, no extra dependencies —
it calls the Resend API directly), which:

1. Validates the lead and re-computes the estimate server-side.
2. Emails the full lead to **asiddique@gmail.com**, with reply-to set to the
   visitor so Asim can just hit Reply.
3. Sends an instant auto-reply to the visitor.

If sending fails (e.g. no API key yet), the page tells the visitor to use
the "Copy message" button and text/email it instead — no enquiry is lost
silently. Booking is by tap-to-text, not Calendly: `sms:+18033868526` links
(pre-filled "Hi Asim, I'd like to book a quick call about a website") are
in the hero, the How-it-works Talk step, the planner thank-you state and
the closing section. Phone is a `tel:` link and email a `mailto:` link
wherever shown.

## To go live (Asim)

1. **Push this repo to GitHub** (`asiddique99/palmetto-web-works`) — Vercel
   deploys it automatically if connected, as today.
2. **Resend (free tier, $0):** create an account at resend.com, verify the
   sending domain `allmomentumlab.com` (Resend asks you to add a few DNS
   records), and copy the API key.
3. **Vercel → Project Settings → Environment Variables**, add:
   - `RESEND_API_KEY` = the key from step 2 (never commit a key to the repo)
   - `RESEND_FROM` = `Palmetto Web Works <hello@allmomentumlab.com>`
     (optional — this is the default if unset, but the domain must be
     verified in Resend or sending will be rejected)
4. **Redeploy** in Vercel after adding the env vars, then test: fill in the
   planner as a fake customer and submit. Confirm the lead email arrives at
   **asiddique@gmail.com** (not siddique@gmail.com — different inbox) and
   the auto-reply arrives at the test email within a minute. Also test the
   tap-to-text link on a phone.

## Local test

The page itself needs no build step — open `index.html` in a browser to
check layout and the estimate maths (the form POST will 404 without Vercel,
which is expected locally). To test the function, run it with Vercel CLI
(`vercel dev`) or mock `fetch` — see the test notes in the handoff.
