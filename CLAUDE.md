# CLAUDE.md

Project context for Claude Code. Read this before making changes.

## What this is

The website for **Spice One Merchants** (Madurai, Tamil Nadu) — a green cardamom
business with three distinct customer types:

1. **Export (GCC)** — bulk green cardamom to UAE, Oman, Saudi Arabia, Qatar,
   Bahrain, Kuwait. Quoted in **USD**. Incoterms: FOB / CIF / CFR.
2. **Domestic B2B (India)** — bulk resale within India. Quoted in **INR**,
   GST applicable.
3. **Retail** — cardamom garlands for weddings and temple use. Small quantities.

The site's job is **lead generation**. Most traffic arrives from Google search
and from the Instagram page. Primary conversion action is a **WhatsApp enquiry**.

## Current rework: auction is being retired

**Status: planned, not yet implemented.** As of now the auction module is still
fully live and unguarded — `/api/auction/*` routes are registered unconditionally,
the frontend imports and routes to `AuctionList`/`AuctionRoom` eagerly, and auction
UI is wired into the homepage, navbar, bottom nav, and buyer/seller/admin
dashboards. The target state below is what the rework should produce, not a
description of the repo today.

This site was originally built as an auction-based B2B platform. That model is
being dropped. The auction code must be **soft-deleted, not removed**:

- `AUCTION_ENABLED` env flag should gate the auction routers in FastAPI. Default
  `false`. Routers must be gated at registration — not merely unlinked from the
  frontend.
- Auction frontend components should move to `frontend/src/legacy/auction/` and
  be excluded from the bundle via guarded lazy imports.
- Auction MongoDB collections should be retained with `archived: true` on
  documents. **Do not drop these collections.**
- The pre-rework state is preserved at git tag `v1-auction`.

Do not delete auction code, collections, or the tag without being asked.

## Stack

- Backend: FastAPI (Python)
- Frontend: React
- Database: MongoDB Atlas
- Hosting: Render (backend), Vercel (frontend)

## Rules that must not be broken

### Compliance — these are legal, not stylistic

- **Never write copy claiming an export licence or Spice Board registration.**
  Spice Board CRES has not yet been obtained. Past shipments moved under a
  partner company's licence. Describe capability ("export-quality", "shipments
  to Oman completed") — never claim credentials not yet held.
- **No FSSAI licence number on the site until it is issued.** Leave a
  placeholder. Once issued, it must be displayed.
- **No payment gateway or cart on the retail section.** Taking online payment
  for food products triggers FSSAI display obligations, refund/returns policy
  requirements and e-commerce disclosure rules. WhatsApp order + UPI stays
  out of that scope.
- **No firm prices published.** Cardamom is volatile. Any price shown must be
  an indicative **band**, date-stamped, marked "subject to confirmation".

### SEO — search is the lead source

- Never let an indexed URL 404. Old auction paths must 301-redirect to the
  closest new page. Check Search Console before remapping.
- Each grade gets its own page (8mm+ Bold, 7-8mm, 6-7mm, garlands).
- Each GCC market gets its own page.
- Product and Organization schema markup on grade pages.

### Secrets

- `.env` must stay in `.gitignore`. It holds the MongoDB Atlas connection string.
- Never commit credentials, connection strings or API keys. Never print them
  in logs or error messages.

## WhatsApp enquiry links

Every product page has a `wa.me` deep link with a pre-filled template. The
prefix identifies the lead type so it can be triaged on arrival.

Export template fields: grade, quantity (kg), destination port, Incoterm,
company name, required-by date.

Domestic template fields: grade, quantity (kg), delivery city, GSTIN,
required-by date.

Retail template fields: quantity, date needed, delivery pincode.

These fields are deliberate — they are the minimum needed to produce a
quotation without a follow-up round of questions. Do not trim them.

## Planned build order

**Phase 1** — auction flag + redirects + three-way homepage split
(Export / Domestic / Retail) with WhatsApp deep links.

**Phase 2** — lead pipeline (every enquiry recorded with source page, grade,
quantity, destination, Incoterm, timestamp; admin view with
New → Quoted → Negotiating → Won/Lost) and admin-editable grade catalog
(grades, photos, packing specs, availability, MOQ — editable without redeploy).

**Phase 3** — daily indicative price band (admin-entered, date-stamped) and
quotation generator (lead data + rate + freight → PDF; USD with Incoterm for
export, INR with GST breakup for domestic).

Quotation PDFs are client-facing: show **only** grade, quantity, price, total
value and terms. Internal costing, INR figures and margin never appear in
client-facing output.

## Reference data

- Standard carton: H 37.5cm x L 40.5cm x W 28cm, 10kg net, gross ~1.14x net.
- Export hub: Kochi (Cochin Port / Vallarpadam).

## Working conventions

- Small, focused commits. One concern per commit.
- Use `git mv` when moving files so history is preserved.
- Work on a feature branch, never directly on `main`.
- Check the Vercel preview deployment before merging — `main` is live to
  buyers arriving from Google.