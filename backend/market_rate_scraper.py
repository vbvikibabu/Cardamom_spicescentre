"""
Scrapes the Spices Board of India's daily small-cardamom auction price page.

Pure HTML fetch + parse — no database or pydantic knowledge here. The caller
(server.py) owns validation, persistence and the manual-wins rule; this
module's only job is turning the page into plain dicts, and it must never
raise for a single bad row — one malformed row must not cost the rest of the
page.

The set of auctioneers on this page changes over time and must never be
hardcoded here — whatever name is in the "Auctioneer" cell is used as-is.
"""
import logging
from datetime import datetime
from typing import Dict, List, Tuple

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SPICES_BOARD_SMALL_CARDAMOM_URL = "https://www.indianspices.com/marketing/price/domestic/daily-price-small.html"
USER_AGENT = "CardamomSpicesCentreMarketRateBot/1.0 (+https://cardamomspicescentre.com; contact: cardamomspicescentre@gmail.com)"
REQUEST_TIMEOUT_SECONDS = 15


def fetch_auction_page_html(page: int = 1) -> str:
    """
    One blocking GET. page=1 is the base URL (today's most recent results,
    used by the scheduled scrape); page>1 appends the archive's own ?page=N
    for the one-off historical backfill — same table on every page, just
    further back (10 rows per page).
    """
    url = SPICES_BOARD_SMALL_CARDAMOM_URL if page <= 1 else f"{SPICES_BOARD_SMALL_CARDAMOM_URL}?page={page}"
    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.text


def _parse_date(raw: str) -> str:
    # Site format: "17-Sep-2026" -> stored format: "2026-09-17"
    return datetime.strptime(raw.strip(), "%d-%b-%Y").strftime("%Y-%m-%d")


def _parse_number(raw: str) -> float:
    return float(raw.strip().replace(",", ""))


def _repair_double_decimal(raw: str) -> float:
    """
    Repairs one specific known malformed shape seen from the source: a value
    with exactly two decimal points where the final segment is exactly "00"
    (e.g. "3169.59.00" -> 3169.59) — a trailing ".00" apparently duplicated
    onto an already-complete number. Raises ValueError for anything else, so
    this is never a general "strip trailing characters" rule — it would
    otherwise corrupt a well-formed value like "3080.89".
    """
    cleaned = raw.strip().replace(",", "")
    parts = cleaned.split(".")
    if len(parts) == 3 and parts[2] == "00" and parts[0] and parts[1]:
        return float(f"{parts[0]}.{parts[1]}")
    raise ValueError(f"'{raw}' does not match the known double-decimal repair pattern")


def _parse_avg_price(raw: str) -> Tuple[float, bool]:
    """Returns (value, was_repaired). Tries a normal parse first; only falls
    back to the double-decimal repair if that fails."""
    try:
        return _parse_number(raw), False
    except ValueError:
        return _repair_double_decimal(raw), True


def parse_auction_rows(html: str) -> Tuple[List[Dict], int, int]:
    """
    Returns (rows, malformed_row_count, repaired_row_count).

    Each dict in `rows` has keys matching MarketRateCreate's fields exactly
    (auction_date, auctioneer, lots, qty_arrived_kg, qty_sold_kg, max_price,
    min_price, avg_price) and is ready to unpack as
    MarketRateCreate(**row, source="auto").

    Finds the <table> whose header row contains both "Date of Auction" and
    "Auctioneer" — not by id/class, since the page's own container id
    ("table-conatainer") is a typo that could get "fixed" later and break an
    id-based selector, and a hidden search-form table elsewhere on the page
    also contains the word "Auctioneer" alone. Raises RuntimeError if no such
    table is found, since that means the page structure changed in a way
    this parser doesn't understand — the caller turns that into a clear
    failed run rather than silently returning nothing.

    A body row with the wrong number of cells, or any field that fails to
    convert, is dropped and logged here, never raised — one bad row must not
    abort the rest of the page. The one known exception is avg_price's
    double-decimal shape (e.g. "3169.59.00"), which is repaired in place
    (see `_repair_double_decimal`) and logged as a repair, not a drop.
    """
    soup = BeautifulSoup(html, "html.parser")

    target_table = None
    for table in soup.find_all("table"):
        header_row = table.find("tr")
        header_text = header_row.get_text() if header_row else ""
        if "Date of Auction" in header_text and "Auctioneer" in header_text:
            target_table = table
            break

    if target_table is None:
        raise RuntimeError(
            "Could not locate the auction results table on the Spices Board page "
            "— page structure may have changed"
        )

    body_rows = target_table.find_all("tr")[1:]  # skip header row
    rows: List[Dict] = []
    malformed = 0
    repaired = 0

    for tr in body_rows:
        cells = tr.find_all("td")
        if len(cells) < 9:
            malformed += 1
            logger.warning(
                f"Market rate scrape: row has {len(cells)} cells, expected 9 — skipping: "
                f"{tr.get_text(' ', strip=True)}"
            )
            continue
        try:
            avg_price_raw = cells[8].get_text()
            avg_price, was_repaired = _parse_avg_price(avg_price_raw)
            if was_repaired:
                repaired += 1
                logger.warning(
                    f"Market rate scrape: repaired malformed avg_price "
                    f"'{avg_price_raw.strip()}' -> {avg_price} in row: {tr.get_text(' ', strip=True)}"
                )
            rows.append({
                "auction_date": _parse_date(cells[1].get_text()),
                "auctioneer": cells[2].get_text(strip=True),
                "lots": int(_parse_number(cells[3].get_text())),
                "qty_arrived_kg": _parse_number(cells[4].get_text()),
                "qty_sold_kg": _parse_number(cells[5].get_text()),
                "max_price": _parse_number(cells[6].get_text()),
                "min_price": _parse_number(cells[7].get_text()),
                "avg_price": avg_price,
            })
        except (ValueError, IndexError) as e:
            malformed += 1
            logger.warning(
                f"Market rate scrape: could not parse row values, skipping: "
                f"{tr.get_text(' ', strip=True)} ({e})"
            )
            continue

    return rows, malformed, repaired
