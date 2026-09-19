import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, MessageSquare, Handshake } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const formatINR = (n) => Math.round(n).toLocaleString('en-IN');

const getProductImage = (product) => {
  if (!product) return null;
  if (product.media_paths?.length > 0) {
    const img = product.media_paths.find(url =>
      /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) || url.includes('/image/upload/')
    );
    if (img) return img;
    const vid = product.media_paths.find(url => url.includes('/video/upload/'));
    if (vid) return vid
      .replace('/video/upload/', '/video/upload/so_0,f_jpg,q_80/')
      .replace(/\.(mp4|mov)$/, '.jpg');
  }
  if (product.image_url) return product.image_url;
  return null;
};

const HOW_IT_WORKS = [
  {
    step: '01', icon: Search, title: 'Browse Grades',
    desc: "Explore our grades and see the day's Spices Board auction rates for context.",
  },
  {
    step: '02', icon: MessageSquare, title: 'Send an Enquiry',
    desc: 'Share your grade, quantity and delivery location. No account needed.',
  },
  {
    step: '03', icon: Handshake, title: 'Get Your Quote',
    desc: 'Receive a price and close the deal directly over WhatsApp or phone.',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [products, setProducts]           = useState([]);
  const [marketRates, setMarketRates]     = useState({ auction_date: null, stale: false, rows: [] });
  const [marketRateHistory, setMarketRateHistory] = useState([]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, marketRatesRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/api/products`),
        axios.get(`${API_URL}/api/market-rates/latest`),
        axios.get(`${API_URL}/api/market-rates/history?days=30`)
      ]);
      const prods = prodRes.data || [];
      setProducts(prods.slice(0, 4));
      setMarketRates(marketRatesRes.data);
      setMarketRateHistory(historyRes.data || []);
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

  // A sparse chart looks broken, so it's hidden below a minimum point count
  // rather than rendered thin. History is already sorted oldest-first by the API.
  const showTrendChart = marketRateHistory.length >= 10;

  // Different auctioneers report on different days, so the raw daily series
  // jumps by which auctioneers happened to report that day, not by market
  // movement. A trailing 3-day rolling average smooths that composition noise
  // out. The first two points use a shorter window since there's no earlier
  // history yet — that's the standard, expected edge behaviour for a rolling
  // average, not a bug.
  const trendData = marketRateHistory.map((point, i) => {
    const window = marketRateHistory.slice(Math.max(0, i - 2), i + 1);
    const rollingAvg = window.reduce((s, p) => s + p.weighted_avg_price, 0) / window.length;
    return { auction_date: point.auction_date, rollingAvg };
  });

  const trendChange = showTrendChart
    ? trendData[trendData.length - 1].rollingAvg - trendData[0].rollingAvg
    : 0;
  const trendLabel = `${trendChange >= 0 ? '+' : '-'}₹${formatINR(Math.abs(trendChange))}`;

  // 4 evenly spaced x-axis labels instead of one per point.
  const trendXTicks = (() => {
    const n = marketRateHistory.length;
    if (n === 0) return [];
    const idxs = n <= 4
      ? marketRateHistory.map((_, i) => i)
      : [0, Math.round((n - 1) / 3), Math.round((n - 1) * 2 / 3), n - 1];
    return [...new Set(idxs)].map(i => marketRateHistory[i].auction_date);
  })();

  // Widen the range ~10% on each side so small day-to-day moves don't read
  // as dramatic swings against a tightly-cropped axis.
  const trendYDomain = (() => {
    if (trendData.length === 0) return ['auto', 'auto'];
    const values = trendData.map(p => p.rollingAvg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const pad = range > 0 ? range * 0.1 : Math.max(min * 0.1, 1);
    return [min - pad, max + pad];
  })();

  return (
    <div className="min-h-screen bg-[#f5f0e8] pb-20 md:pb-0">

      {/* ── SECTION 1: HERO ─────────────────────── */}
      <section className="bg-[#f5f0e8] pt-24 md:pt-28">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 min-[900px]:grid-cols-[55%_45%] gap-8 min-[900px]:h-[520px]">

            {/* Text column — same grid, same container as "Available Grades" below, so the left edge always matches */}
            <div className="flex flex-col justify-center gap-3 py-8 min-[900px]:py-0">
              <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[#2d5a27]">
                Sourced at Bodinayakanur &amp; Idukki
              </span>
              <h1 className="font-serif text-[36px] leading-[1.15] text-[#1a3a1a] max-w-[420px]">
                Green cardamom,<br />graded to your spec
              </h1>
              <p className="text-[15px] text-gray-600 max-w-[400px] leading-relaxed">
                Bulk supply for wholesalers and manufacturers. Packed to order, quoted against the day's market.
              </p>
              <button
                onClick={() => navigate('/products')}
                className="bg-[#2d5a27] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1a3a1a] transition-colors text-sm w-fit mt-1"
              >
                Request a price
              </button>
            </div>

            {/* Image column — fills its grid cell exactly, no margin/padding of its own */}
            <div className="h-64 min-[900px]:h-full overflow-hidden">
              <img
                src="/hero.jpg"
                alt="Graded green cardamom held in hand at the sorting floor"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LIVE LISTINGS ─────────────── */}
      {products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-serif text-2xl text-[#1a3a1a]">Available Grades</h2>
            <Link to="/products" className="text-[#2d5a27] text-sm font-semibold hover:underline">
              Browse All →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {products.map(product => (
              <div
                key={product.id}
                className="bg-white rounded-xl overflow-hidden border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <div className="relative">
                  {getProductImage(product) ? (
                    <img
                      src={getProductImage(product)}
                      alt={product.name}
                      className="w-full object-cover"
                      style={{ height: 130 }}
                    />
                  ) : (
                    <div className="w-full bg-[#c8d8b8] flex items-center justify-center text-3xl" style={{ height: 130 }}>
                      🌿
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{product.size}</p>
                  <p className="font-semibold text-[#1a3a1a] text-sm line-clamp-1 mb-0.5">{product.name}</p>
                  {product.minimum_quantity_kg && (
                    <p className="text-[11px] text-gray-400">Min: {product.minimum_quantity_kg} kg</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION: AUCTION MARKET RATES ────────── */}
      {(marketRates.stale || (marketRates.rows && marketRates.rows.length > 0)) && (
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
                  {new Date(marketRates.auction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                        <span className="text-gray-400">30-day trend (3-day avg)</span>
                        <span className={trendChange >= 0 ? 'text-[#2d5a27] font-semibold' : 'text-red-600 font-semibold'}>
                          {trendLabel}
                        </span>
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
                              formatter={v => [`₹${formatINR(v)}`, '3-day avg']}
                              labelFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }}
                              labelStyle={{ color: '#9ca3af', marginBottom: 2 }}
                              itemStyle={{ color: '#1a3a1a' }}
                              cursor={{ stroke: '#c8d8b8', strokeWidth: 1 }}
                            />
                            <Area
                              type="linear"
                              dataKey="rollingAvg"
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
                <Link
                  to="/products"
                  className="flex-shrink-0 bg-[#2d5a27] text-white px-3 py-1.5 rounded-md text-[13px] font-semibold hover:bg-[#1a3a1a] transition-colors"
                >
                  Get a price
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── SECTION 3: HOW IT WORKS ──────────────── */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <h2 className="font-serif text-2xl text-[#1a3a1a] mb-6 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl font-black text-[#2d5a27] opacity-20 leading-none select-none">{item.step}</span>
                <item.icon size={26} strokeWidth={1.75} className="text-[#2d5a27]" />
              </div>
              <h3 className="font-semibold text-[#1a3a1a] mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/register')}
            className="bg-[#2d5a27] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#1a3a1a] transition-colors text-sm"
          >
            Join as Trader →
          </button>
        </div>
      </section>

    </div>
  );
}
