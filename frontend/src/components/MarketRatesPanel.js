import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Extracted verbatim from Home.js's inline auction-rates section so both the
// home page and the dedicated /cardamom-auction-price page render the same
// table/chart from the same calculations — nothing here changes how either
// is computed.

const API_URL = process.env.REACT_APP_BACKEND_URL;
const TREND_DISPLAY_DAYS = 30;

const formatINR = (n) => Math.round(n).toLocaleString('en-IN');

// linkToFullPage: shows a "View full history & trend" link to the dedicated
// auction page. Passed by Home; the dedicated page itself omits it.
const MarketRatesPanel = ({ linkToFullPage = false }) => {
  const [marketRates, setMarketRates] = useState({ auction_date: null, stale: false, rows: [] });
  const [marketRateHistoryRaw, setMarketRateHistoryRaw] = useState([]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    try {
      const [marketRatesRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/api/market-rates/latest`),
        axios.get(`${API_URL}/api/market-rates/history?days=${TREND_DISPLAY_DAYS}`)
      ]);
      setMarketRates(marketRatesRes.data);
      setMarketRateHistoryRaw(historyRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // The backend returns raw per-auctioneer rows across the most recent few
  // auction dates (staleness itself is decided server-side, on the single
  // latest date). Group those by date and aggregate across auctioneers —
  // auctioneer identity doesn't matter to a buyer, only the date does.
  const marketRateDays = (() => {
    const rows = marketRates.rows;
    if (!rows || rows.length === 0) return [];
    const byDate = {};
    rows.forEach(r => {
      (byDate[r.auction_date] = byDate[r.auction_date] || []).push(r);
    });
    return Object.entries(byDate)
      .map(([date, dateRows]) => {
        const qtySold = dateRows.reduce((s, r) => s + (r.qty_sold_kg || 0), 0);
        const avg = qtySold > 0
          ? dateRows.reduce((s, r) => s + r.avg_price * (r.qty_sold_kg || 0), 0) / qtySold
          : dateRows.reduce((s, r) => s + r.avg_price, 0) / dateRows.length;
        return {
          date,
          low: Math.min(...dateRows.map(r => r.min_price)),
          high: Math.max(...dateRows.map(r => r.max_price)),
          avg,
          qtySold,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
  })();
  const latestMarketDay = marketRateDays[0] || null;

  // Plot each auction date's own quantity-weighted average directly — this
  // must match the table's Avg column for the same date, so no smoothing
  // here. The backend already applies the `days` cutoff, oldest first.
  const trendData = marketRateHistoryRaw.map(point => ({
    auction_date: point.auction_date,
    avgPrice: point.weighted_avg_price,
  }));

  // A sparse chart looks broken, so it's hidden below a minimum point count.
  const showTrendChart = trendData.length >= 10;

  const trendChange = showTrendChart
    ? trendData[trendData.length - 1].avgPrice - trendData[0].avgPrice
    : 0;
  const trendLabel = `${trendChange >= 0 ? '+' : '-'}₹${formatINR(Math.abs(trendChange))}`;

  const trendStartDateLabel = showTrendChart
    ? new Date(trendData[0].auction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

  // 4 evenly spaced x-axis labels instead of one per point.
  const trendXTicks = (() => {
    const n = trendData.length;
    if (n === 0) return [];
    const idxs = n <= 4
      ? trendData.map((_, i) => i)
      : [0, Math.round((n - 1) / 3), Math.round((n - 1) * 2 / 3), n - 1];
    return [...new Set(idxs)].map(i => trendData[i].auction_date);
  })();

  // Widen the range ~10% on each side so small day-to-day moves don't read
  // as dramatic swings against a tightly-cropped axis.
  const trendYDomain = (() => {
    if (trendData.length === 0) return ['auto', 'auto'];
    const values = trendData.map(p => p.avgPrice);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const pad = range > 0 ? range * 0.1 : Math.max(min * 0.1, 1);
    return [min - pad, max + pad];
  })();

  if (!(marketRates.stale || (marketRates.rows && marketRates.rows.length > 0))) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      {marketRates.stale ? (
        <div className="bg-white rounded-xl p-5 border border-gray-100 text-center text-sm text-gray-500">
          Rates update after each auction — check back after the next trading day.
        </div>
      ) : latestMarketDay && (
        <div className={`text-[13px] text-gray-600 ${showTrendChart ? '' : 'max-w-[680px]'}`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-[#1a3a1a]">Auction rates</h2>
            <span className="text-gray-400">
              Last auction · {new Date(marketRates.auction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <p className="text-gray-400 mb-4">Small cardamom · Spices Board of India</p>

          <div className={showTrendChart ? 'flex flex-col min-[900px]:flex-row gap-6 items-stretch' : ''}>
            {/* Left ~55%: the table */}
            <div className={showTrendChart ? 'min-[900px]:w-[55%] flex' : ''}>
              <div className="bg-white rounded-xl p-5 w-full">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400">
                      <th className="text-left font-normal py-1.5">Date</th>
                      <th className="text-right font-normal py-1.5">Low ₹/kg</th>
                      <th className="text-right font-normal py-1.5">Avg ₹/kg</th>
                      <th className="text-right font-normal py-1.5">High ₹/kg</th>
                      <th className="text-right font-normal py-1.5">Sold (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketRateDays.map(d => (
                      <tr key={d.date} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-1.5 pr-2 text-[#1a3a1a]">
                          {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-gray-400">{formatINR(d.low)}</td>
                        <td className="py-1.5 text-right tabular-nums text-[#1a3a1a] font-semibold">{formatINR(d.avg)}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-400">{formatINR(d.high)}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-400">{formatINR(d.qtySold)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right ~45%: 30-day trend, hidden when too sparse to read as a trend */}
            {showTrendChart && (
              <div className="min-[900px]:w-[45%] mt-6 min-[900px]:mt-0 flex">
                <div className="bg-white rounded-xl p-5 w-full flex flex-col">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-gray-400">30-day trend</span>
                    <div className="text-right">
                      <span className={trendChange >= 0 ? 'text-[#2d5a27] font-semibold' : 'text-[#a13d3d] font-semibold'}>
                        {trendLabel}
                      </span>
                      <div className="text-[11px] text-gray-400">since {trendStartDateLabel}</div>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7a9b6a" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#7a9b6a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#eee" />
                        <XAxis
                          dataKey="auction_date"
                          ticks={trendXTicks}
                          tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          tick={{ fontSize: 11, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={v => formatINR(v)}
                          tick={{ fontSize: 11, fill: '#9ca3af' }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tickCount={3}
                          domain={trendYDomain}
                        />
                        <Tooltip
                          formatter={v => [`₹${formatINR(v)}`, 'Avg']}
                          labelFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
                          labelStyle={{ color: '#9ca3af', marginBottom: 2 }}
                          itemStyle={{ color: '#1a3a1a' }}
                          cursor={{ stroke: '#c8d8b8', strokeWidth: 1 }}
                        />
                        <Area
                          type="linear"
                          dataKey="avgPrice"
                          stroke="#7a9b6a"
                          strokeWidth={1.5}
                          fill="url(#trendFill)"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mt-3">
            <p className="text-gray-600">
              Size is only part of it. Lighter lots, poor colour and splits pull a lot toward the low end
              of each day's range — the spread between low and high is grade.
            </p>
            <div className="flex-shrink-0 flex items-center gap-3">
              {linkToFullPage && (
                <Link
                  to="/cardamom-auction-price"
                  className="text-[#2d5a27] text-[13px] font-semibold hover:underline whitespace-nowrap"
                >
                  Full history & trend →
                </Link>
              )}
              <Link
                to="/products"
                className="bg-[#2d5a27] text-white px-3 py-1.5 rounded-md text-[13px] font-semibold hover:bg-[#1a3a1a] transition-colors whitespace-nowrap"
              >
                Get a price
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MarketRatesPanel;
