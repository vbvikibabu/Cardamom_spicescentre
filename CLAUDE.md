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

The legacy `/bids` feature is a sealed private-offer system: the buyer submits
one private offer, the seller accepts or rejects; no visible price ladder, no
minimum increments, no competing bidders. It is being reshaped into RFQ.
User-facing copy uses enquiry language — "Request a Price", "My Enquiries",
"Offers Received" — never "bid", "bidding" or "bidder". Database field names
may keep `bid_*`.

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

### Auction rates — live, scraped automatically (DONE)

See the Auction rates section below for the full design and its rules.

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

## Auction rates (public market data)

Source: the Spices Board archive page for small cardamom
(`daily-price-small.html`), which publishes **previous-day** results per
auctioneer with lots, quantity arrived, quantity sold, max price, min price and
average price. Ten rows per page spanning several dates and many auctioneers —
never hardcode an auctioneer list.

### Data and collection

- `market_rates` collection, one document per auctioneer per auction date.
  Unique compound index on `(auction_date, auctioneer)`; writes are upserts on
  that key.
- `source` is `"manual"` or `"auto"`. Admin write paths force `"manual"`
  server-side. **A scraped row never overwrites a manual one.**
- Every row, scraped or entered, must pass `MarketRateCreate` validation
  including the min/max/avg range check. Invalid rows are skipped and logged,
  never written partially.

### Scraping

- `backend/market_rate_scraper.py`, endpoint `POST /api/admin/market-rates/scrape`
  behind the `X-Scrape-Secret` header, run every 6 hours by
  `.github/workflows/scrape-market-rates.yml`.
- The endpoint returns a non-2xx when a run produces nothing usable, so a
  page-structure change fails the scheduled Action rather than quietly serving
  old numbers.
- Manual entry via AdminDashboard remains available and always takes precedence.

This supersedes the original "manual entry first, do not scrape" caution. That
caution warned about one specific failure — a silently broken scraper showing
stale data as current — and the three rules above are the direct answer to it.

### Display

- **Always label the actual auction date. Never "Today's Market"** — this is
  previous-day data and must not read as live.
- **Staleness:** the public endpoint decides, not the browser. If the latest
  entry is more than 4 days old it returns the stale flag with no rows, so a
  stale figure can never reach the client.
- Credit "Source: Spices Board of India".
- Presentation is a compact data table, not an infographic. One row per auction
  date, newest first, aggregated across auctioneers: Date, Low, Avg, High, Sold.
  Avg is the quantity-weighted average. Auctioneer names stay in the data but
  are not displayed — they mean nothing to a buyer and the row count varies
  daily.
- Below the table, the grade line: size is only part of it — lighter lots, poor
  colour and splits pull a lot toward the low end. Then the spread stated as a
  figure, with a compact enquiry CTA inline.
- The spread is the argument. A blended average says nothing about a specific
  grade, and the day's min-to-max gap is the evidence.

## Product model — needs rework

The Product model was built for auction lots and still carries `base_price`,
`bid_duration_hours` and `bid_end_time`. What a cardamom buyer actually judges
is grade spec: liter weight (g/l), screen size (mm), moisture %, colour, split
percentage, packing spec, MOQ, available quantity. The catalog should move
toward those fields.

The listing timer was 1-8 hours (auction-appropriate) and has been widened;
buyer-facing countdowns create pressure on someone who is only enquiring and
should not be shown.

## Still to build

- Remove `base_price` from all public views and responses.
- 30-day price trend chart under the auction rates table, plus a one-off
  backfill of history from the paginated Board archive.
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
- **Pushing to `bidding-changes` is fine. Never push to `bidding` or `main`** —
  only `bidding` deploys to production (Render and Vercel). Never run
  `git push --force` or `git reset --hard`.
- **Do not build mock backends, start dev servers, or verify in a browser by
  default.** The owner checks the deployed site directly. If a change is complex
  enough that verification is genuinely worthwhile, ask first and wait for a yes
  — do not assume.
- **Compile checks are always fine and need no asking.** Use `py -m py_compile`
  for backend changes (note: `python` hits a Microsoft Store alias stub on this
  machine — `py` is the working command) and a Babel parse for frontend changes.
  Never report a large structural backend change as verified when it has not
  been compiled.
- For large structural changes, show the diff before applying.