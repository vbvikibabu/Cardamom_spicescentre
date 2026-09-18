import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

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
    step: '01', icon: '👤', title: 'Register & Verify',
    desc: 'Create your account as buyer or seller. Admin verifies within 24 hours.',
  },
  {
    step: '02', icon: '🔨', title: 'Request a Price',
    desc: 'Browse live listings and send an enquiry, or list your cardamom for buyers.',
  },
  {
    step: '03', icon: '🤝', title: 'Close the Deal',
    desc: "Seller reviews and accepts the best offer. Connect directly and complete your trade.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [products, setProducts]           = useState([]);
  const [marketRates, setMarketRates]     = useState({ auction_date: null, stale: false, rows: [] });

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, marketRatesRes] = await Promise.all([
        axios.get(`${API_URL}/api/products`),
        axios.get(`${API_URL}/api/market-rates/latest`)
      ]);
      const prods = prodRes.data || [];
      setProducts(prods.slice(0, 4));
      setMarketRates(marketRatesRes.data);
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

  return (
    <div className="min-h-screen bg-[#f5f0e8] pb-20 md:pb-0">

      {/* ── SECTION 1: HERO ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">

          {/* Left — copy & CTAs */}
          <div className="flex-1 min-w-0">
            {/* Headline */}
            <h1 className="font-serif text-4xl md:text-5xl xl:text-6xl text-[#1a3a1a] leading-[1.15] mb-4">
              Export-Quality<br />
              <span className="text-[#2d5a27]">Green Cardamom</span><br />
              Direct From the Source
            </h1>

            <p className="text-gray-600 text-base md:text-lg mb-7 max-w-md leading-relaxed">
              Sourced direct from Bodinayakanur &amp; Idukki.<br />
              Bulk B2B supply and retail cardamom garlands.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => navigate('/products')}
                className="bg-[#2d5a27] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1a3a1a] transition-colors flex items-center gap-2 text-sm"
              >
                🌿 Bulk B2B (India)
              </button>
              <button
                onClick={() => navigate('/products')}
                className="border-2 border-[#2d5a27] text-[#2d5a27] px-6 py-3 rounded-xl font-semibold hover:bg-[#2d5a27] hover:text-white transition-colors text-sm"
              >
                💐 Cardamom Garlands
              </button>
            </div>
          </div>

          {/* Right — featured product / placeholder */}
          <div className="w-full md:w-80 flex-shrink-0">
            {products[0] ? (
              <div
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/products/${products[0].id}`)}
              >
                {getProductImage(products[0]) ? (
                  <img
                    src={getProductImage(products[0])}
                    alt={products[0].name}
                    className="w-full h-44 object-cover"
                  />
                ) : (
                  <div className="w-full h-44 bg-[#c8d8b8] flex items-center justify-center text-5xl">🌿</div>
                )}
                <div className="p-4">
                  <span className="text-[11px] bg-[#f5f0e8] text-gray-500 px-2 py-0.5 rounded-full">{products[0].size}</span>
                  <h3 className="font-semibold text-[#1a3a1a] mt-2 mb-3 line-clamp-1">{products[0].name}</h3>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/products/${products[0].id}`); }}
                    className="w-full bg-[#2d5a27] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1a3a1a] transition-colors"
                  >
                    Request a Price →
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#1a3a1a] rounded-2xl p-6 text-center shadow-lg">
                <p className="text-5xl mb-3">🌿</p>
                <p className="text-white font-serif text-lg mb-2">Premium Cardamom</p>
                <p className="text-green-300 text-sm mb-4">Direct from South India's finest plantations</p>
                <button
                  onClick={() => navigate('/products')}
                  className="w-full border border-white/60 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  Browse Products
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LIVE LISTINGS ─────────────── */}
      {products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-serif text-2xl text-[#1a3a1a]">🌿 Live Listings</h2>
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
            <div className="max-w-[680px] mx-auto text-[13px] text-gray-600">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-2xl text-[#1a3a1a]">Auction rates</h2>
                <span className="text-gray-400">
                  {new Date(marketRates.auction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="text-gray-400 mb-4">Small cardamom · Spices Board of India</p>

              <div className="bg-white rounded-xl p-5">
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
                <span className="text-2xl">{item.icon}</span>
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
