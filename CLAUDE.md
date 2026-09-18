# CLAUDE.md

Project context for Claude Code. Read this before making changes.

## What this is

The website for **Spice One Merchants** (Madurai, Tamil Nadu), trading as
**Cardamom Spices Centre**, a green cardamom business with three customer types:

1. **Domestic B2B (India)** — bulk resale within India. Quoted in **INR**,
   GST applicable. **This is the active revenue channel today.**
2. **Export (GCC)** — bulk green cardamom to UAE, Oman, Saudi Arabia, Qatar,
   Bahrain, Kuwait. Quoted in **USD**. Incoterms: FOB / CIF / CFR.
   **Blocked until licences are obtained — see Compliance.**
3. **Retail** — cardamom garlands for weddings and temple use. Small quantities.

The site's job is **lead generation**. Traffic arrives from Google search and
the Instagram page. The conversion action is an **enquiry** — the site captures
it, the deal is closed over WhatsApp or phone.

### Brand vs legal entity

- **Cardamom Spices Centre** is the brand. Matches the domain and the Instagram
  handle. Used in the site header, hero and all marketing copy.
- **Spice One Merchants** is the registered legal entity. Used in the site
  footer, on the seller identity block, and on every invoice and quotation.
  GST invoices must carry the legal name exactly as registered.
- Never show a personal name as the seller. The seller is the firm.

## How this business prices — the single most important rule

**No prices are published publicly. Ever.**

Pricing is set per buyer. Margin varies by volume, payment terms, market
(domestic vs export) and how much work the buyer hands over. A published number
becomes a ceiling, removes all negotiating room, and makes per-buyer pricing
impossible to sustain.

Consequences for the code:

- `base_price` on the Product model is **internal only**. Visible in
  AdminDashboard and SellerDashboard. It must never appear in `ProductPublic`,
  in any public API response, on product cards, or on the product detail page.
- No price, band, or estimate of our own anywhere on the public site.
- **Public auction data is different and is allowed.** Spices Board auction
  figures are public information, not our prices — see Auction rates below.

### The enquiry flow is RFQ, not bidding

The buyer states their **requirement** — grade, quantity, delivery location,
timeline, contact. The seller then quotes. The buyer does not name a price.

The legacy `/bids` feature is a sealed private-offer system (buyer submits one
private offer, seller accepts or rejects; no visible price ladder, no minimum
increments, no competing bidders). It is being reshaped into RFQ. User-facing
copy uses enquiry language — "Request a Price", "My Enquiries", "Offers
Received" — never "bid", "bidding" or "bidder". Database field names may keep
`bid_*`.

Known gap, not yet built: the seller can only accept or reject. There is no
counter-offer, which ends conversations that should continue.

## Current state

### Auction module — retired and gated (DONE)

- `AUCTION_ENABLED` env flag, default `false`, gates the auction route block,
  `/buyer/won-lots`, the `@app.websocket("/ws/auction/{lot_id}")` registration
  (registered on `app`, not `api_router`, so it needs its own guard) and the
  `_check_auction_lots()` call in the periodic loop.
- Auction frontend components moved to `frontend/src/legacy/auction/`; routes
  and eager imports removed from `App.js`.
- Auction collections (`auction_events`, `auction_lots`, `auction_bids`) are
  retained in MongoDB. **Do not drop them.**
- Pre-rework state preserved at git tag `v1-auction`. Post-rework baseline at
  `v2-supplier-site`.
- Do not delete auction code, collections or tags without being asked.

### Guest enquiries — live (DONE)

Unauthenticated visitors can submit an enquiry without an account:
`buyer_id=None` (never an empty string), `is_guest=True`, contact details from
`guest_*` fields. Protected by a CSS-hidden honeypot (`website` field, checked
before any DB access) and a per-IP rate limit (`GUEST_BID_RATE_LIMIT`,
`GUEST_BID_RATE_WINDOW_MINUTES`). Guest rows show a "Guest" pill with inline
phone and email in the seller and admin views; the "Verified" badge is gated on
`!is_guest`.

### Multi-seller and buyer accounts — retained

Not gated. Admin is the owner. Other sellers may be onboarded later, so do not
hardcode a single seller anywhere — fix seller data at the source rather than in
components.

### Hardcoded market prices — removed

The `MARKET_PRICES` constant in `Home.js` held invented, undated, never-updated
figures with fake movement arrows. Removed. Do not reintroduce placeholder
prices anywhere.

## Rules that must not be broken

### Compliance — these are legal, not stylistic

- **Never claim an export licence or Spice Board registration.** Spice Board
  CRES has not been obtained. It requires a **Central FSSAI licence**, which is
  still pending — FSSAI is the blocker, CRES sits behind it. Describe capability
  ("export-quality", "shipments to Oman completed"); never claim credentials not
  held. "Export-quality" describes the **product**, not our licensing status.
- **No FSSAI licence number on the site until issued.** Placeholder only.
- **No export pages published until CRES and FSSAI are in hand.** They may be
  written and kept behind a flag so the SEO clock starts early, but must not go
  live implying we can ship.
- **No payment gateway or cart on the retail section.** Online payment for food
  products triggers FSSAI display obligations, refund/returns policy
  requirements and e-commerce disclosure rules. WhatsApp order + UPI avoids all
  of it.

### SEO — search is the lead source

- Never let an indexed URL 404. Old auction paths must 301-redirect to the
  closest new page. Redirects live in `vercel.json`, not FastAPI. Check Search
  Console before remapping.
- Each grade gets its own page (8mm+ Bold, 7-8mm, 6-7mm, garlands).
- Each GCC market gets its own page (built, gated until licences land).
- Product and Organization schema markup on grade pages.
- Garlands are a separate funnel with a separate form. Do not mix retail
  quantities into bulk pages.

### Secrets

- `.env` must stay in `.gitignore`. It holds the MongoDB Atlas connection string.
- Never commit credentials, connection strings or API keys, and never print them
  in logs or error messages.

## Auction rates (public market data) — next to build

Source: the Spices Board daily auction page for small cardamom, which publishes
**previous-day** results per auctioneer with lots, quantity arrived, quantity
sold, max price, min price and average price. Two auctioneers are relevant:
Green House Cardamom Mktg. India Pvt. Ltd, and The Kerala Cardamom Processing
and Marketing Company Limited, Thekkady.

Design rules:

- `market_rates` collection, one document per auctioneer per auction date.
  Admin-entered, under two minutes per day. Admin CRUD behind admin auth; one
  public read endpoint.
- **Always label the actual auction date. Never "Today's Market"** — this is
  previous-day data and must not read as live.
- Display the average, the **min-max range**, total quantity and total lots.
  The range is the point: a spread of well over a thousand rupees on a single
  day is grade variation, and it is the evidence that a blended average says
  nothing about a specific grade.
- Include the explanatory note: the range reflects grade; bold high-liter-weight
  lots trade near the top, small light lots near the bottom; enquire for a price
  on a specific grade and quantity.
- Credit "Source: Spices Board of India".
- **Staleness:** if the latest entry is more than 4 days old, hide the figures
  and show only a note that rates update after each auction. A stale figure
  presented as current is worse than no figure.
- Manual entry first. Do not scrape — the page structure will change and a
  silently broken scraper showing stale data is the worst outcome.

## Product model — needs rework

The Product model was built for auction lots and still carries `base_price`,
`bid_duration_hours` and `bid_end_time`. What a cardamom buyer actually judges
is grade spec: liter weight (g/l), screen size (mm), moisture %, colour, packing
spec, MOQ, available quantity. The catalog should move toward those fields.

The listing timer was 1-8 hours (auction-appropriate) and has been widened;
buyer-facing countdowns create pressure on someone who is only enquiring and
should not be shown.

## Still to build

- Remove `base_price` from all public views and responses.
- Auction rates feature (above).
- Enquiry form: drop price, currency, lots and the commitment checkbox. Collect
  grade, quantity, delivery location, timeline, contact. Five fields.
- Lead pipeline — every enquiry recorded with source page, grade, quantity,
  timestamp; admin view with New → Quoted → Negotiating → Won/Lost. This is the
  highest-value remaining feature: it is what stops an enquiry going unanswered.
- Grade pages and a market/explainer page.
- Quotation generator — INR with GST breakup for domestic, USD with Incoterm for
  export. Client-facing output shows **only** grade, quantity, price, total value
  and terms. Internal costing and margin never appear.
- Counter-offer on enquiries.
- Remove Login/Register from the public header (keep routes reachable).

## Reference data

- Standard carton: H 37.5cm x L 40.5cm x W 28cm, 10kg net, gross ~1.14x net.
- Export hub: Kochi (Cochin Port / Vallarpadam).
- Sourcing: Bodinayakanur and Idukki, via a related-party supplier. Purchases
  must be properly invoiced with bank payments — arm's-length documentation
  matters for GST and ITC.

## Working conventions

- Small, focused commits. One concern per commit.
- Use `git mv` when moving files so history is preserved.
- Work on a feature branch, never directly on `main`.
- **Commit locally. Never run `git push`, `git push --force` or
  `git reset --hard`.** Pushing triggers auto-deploy to Render and Vercel and is
  the owner's call.
- **Python is not runnable in this environment** — `python` hits a Microsoft
  Store alias stub. After any backend change, tell the owner to run
  `py -m py_compile backend/server.py` before deploying. Never report a large
  structural backend change as verified when it has not been compiled.
- Check the Vercel preview deployment before merging — `main` is live to buyers
  arriving from Google.
- For large structural changes, show the diff before applying.