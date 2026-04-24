import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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

const MARKET_PRICES = [
  { grade: '6mm – 7mm', price: '₹2,200', change: '+₹50',  up: true  },
  { grade: '7mm – 8mm', price: '₹2,450', change: 'Stable', up: null  },
  { grade: '8mm & Above', price: '₹2,650', change: '+₹100', up: true },
];

const HOW_IT_WORKS = [
  {
    step: '01', icon: '👤', title: 'Register & Verify',
    desc: 'Create your account as buyer or seller. Admin verifies within 24 hours.',
  },
  {
    step: '02', icon: '🔨', title: 'Trade or Bid',
    desc: 'Browse live listings and place bids, or list your cardamom for buyers.',
  },
  {
    step: '03', icon: '🤝', title: 'Close the Deal',
    desc: "Seller accepts the best bid. Connect directly and complete your trade.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [products, setProducts]           = useState([]);
  const [liveAuction, setLiveAuction]     = useState(null);
  const [upcomingAuction, setUpcomingAuction] = useState(null);
  const [stats, setStats]                 = useState({ listings: 0, traders: '50+', bids: '—' });
  const [timeLeft, setTimeLeft]           = useState({});

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, auctionRes] = await Promise.all([
        axios.get(`${API_URL}/api/products`),
        axios.get(`${API_URL}/api/auction/events/upcoming`),
      ]);
      const prods = prodRes.data || [];
      setProducts(prods.slice(0, 4));
      setStats(s => ({ ...s, listings: prods.length }));

      const events = auctionRes.data || [];
      setLiveAuction(events.find(e => e.status === 'live') || null);
      setUpcomingAuction(
        events.find(e => ['upcoming', 'registration_open'].includes(e.status)) || null
      );
    } catch (err) {
      console.error(err);
    }
  };

  // 1-second countdown for product timer chips
  useEffect(() => {
    const tick = () => {
      const next = {};
      products.forEach(p => {
        if (!p.bid_end_time) return;
        const diff = new Date(p.bid_end_time) - Date.now();
        if (diff <= 0) { next[p.id] = 'Closed'; return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        next[p.id] = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
      });
      setTimeLeft(next);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [products]);

  const featuredEvent = liveAuction || upcomingAuction;

  return (
    <div className="min-h-screen bg-[#f5f0e8] pb-20 md:pb-0">

      {/* ── SECTION 1: HERO ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-10">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">

          {/* Left — copy & CTAs */}
          <div className="flex-1 min-w-0">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 border border-[#2d5a27] rounded-full px-3 py-1 mb-5">
              <span className="text-[11px] text-[#2d5a27] font-bold tracking-widest uppercase">
                🌿 Spiceboard Registered · Est. 2024
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-serif text-4xl md:text-5xl xl:text-6xl text-[#1a3a1a] leading-[1.15] mb-4">
              India's First<br />
              <span className="text-[#2d5a27]">Digital Cardamom</span><br />
              Exchange
            </h1>

            <p className="text-gray-600 text-base md:text-lg mb-7 max-w-md leading-relaxed">
              Real-time bidding. Verified traders.<br />
              Direct from Bodinayakanur.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => navigate('/products')}
                className="bg-[#2d5a27] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1a3a1a] transition-colors flex items-center gap-2 text-sm"
              >
                🔨 Start Trading
              </button>
              <button
                onClick={() => navigate('/auctions')}
                className="border-2 border-[#2d5a27] text-[#2d5a27] px-6 py-3 rounded-xl font-semibold hover:bg-[#2d5a27] hover:text-white transition-colors text-sm"
              >
                📋 View Auctions
              </button>
            </div>

            {/* Live stats row */}
            <div className="flex gap-3">
              {[
                { label: 'Active Listings', value: stats.listings || '—' },
                { label: 'Verified Traders', value: stats.traders },
                { label: 'Bids Today',       value: stats.bids    },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-xl px-3 py-2.5 text-center shadow-sm border border-gray-100 flex-1">
                  <p className="text-xl font-bold text-[#2d5a27] leading-none mb-1">{stat.value}</p>
                  <p className="text-[11px] text-gray-500 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live auction card / featured product / placeholder */}
          <div className="w-full md:w-80 flex-shrink-0">
            {liveAuction ? (
              <div className="bg-[#1a3a1a] rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-xs font-bold tracking-widest uppercase">Live Auction</span>
                </div>
                <h3 className="text-xl font-serif font-bold mb-1 leading-snug">{liveAuction.title}</h3>
                <p className="text-green-300 text-sm mb-1">📍 {liveAuction.location}</p>
                {liveAuction.agent_name && (
                  <p className="text-gray-400 text-xs mb-5">Agent: {liveAuction.agent_name}</p>
                )}
                <button
                  onClick={() => navigate(`/auctions/${liveAuction.id}`)}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  🔨 Join Live Auction
                </button>
              </div>
            ) : products[0] ? (
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
                  <h3 className="font-semibold text-[#1a3a1a] mt-2 mb-1 line-clamp-1">{products[0].name}</h3>
                  <p className="text-[#2d5a27] font-bold text-lg mb-1">
                    ₹{products[0].base_price?.toLocaleString('en-IN')}/kg
                  </p>
                  {timeLeft[products[0].id] && (
                    <p className="text-xs text-gray-400 mb-3">⏰ {timeLeft[products[0].id]} left</p>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/products/${products[0].id}`); }}
                    className="w-full bg-[#2d5a27] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1a3a1a] transition-colors"
                  >
                    Place a Bid →
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

      {/* ── SECTION 2: MARKET PRICES ─────────────── */}
      <section className="bg-white border-y border-gray-100 py-5">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-[#1a3a1a] text-base">📊 Today's Market</h2>
            <span className="text-xs text-gray-400">📍 Bodinayakanur</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {MARKET_PRICES.map((item, i) => (
              <div key={i} className="bg-[#f5f0e8] rounded-xl p-3 md:p-4 text-center">
                <p className="text-[11px] text-gray-500 mb-1 font-medium">{item.grade}</p>
                <p className="text-lg md:text-2xl font-bold text-[#1a3a1a]">{item.price}</p>
                <p className="text-[11px] text-gray-400">/kg</p>
                <p className={`text-xs font-semibold mt-1.5 ${
                  item.up === true  ? 'text-green-600' :
                  item.up === false ? 'text-red-500'   : 'text-gray-400'
                }`}>
                  {item.up === true ? '▲ ' : item.up === false ? '▼ ' : '→ '}{item.change}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: LIVE LISTINGS ─────────────── */}
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
                  {timeLeft[product.id] && timeLeft[product.id] !== 'Closed' && (
                    <div className="absolute bottom-2 left-2 bg-black/65 text-white text-[10px] px-2 py-0.5 rounded-full">
                      ⏰ {timeLeft[product.id]}
                    </div>
                  )}
                  {timeLeft[product.id] === 'Closed' && (
                    <div className="absolute bottom-2 left-2 bg-gray-600/80 text-white text-[10px] px-2 py-0.5 rounded-full">
                      Closed
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{product.size}</p>
                  <p className="font-semibold text-[#1a3a1a] text-sm line-clamp-1 mb-1">{product.name}</p>
                  <p className="text-[#2d5a27] font-bold text-sm">
                    ₹{product.base_price?.toLocaleString('en-IN')}/kg
                  </p>
                  {product.minimum_quantity_kg && (
                    <p className="text-[11px] text-gray-400">Min: {product.minimum_quantity_kg} kg</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION 4: AUCTION BANNER ────────────── */}
      {featuredEvent && (
        <section className="px-4 md:px-8 mb-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-[#1a3a1a] rounded-2xl p-6 md:p-8 text-white shadow-md">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                <div className="flex-1 min-w-0">
                  <p className="text-green-400 text-[11px] font-bold tracking-widest uppercase mb-2">
                    {liveAuction ? '🔴 Live Now' : '🔔 Next Auction'}
                  </p>
                  <h3 className="text-xl md:text-2xl font-serif font-bold mb-1 leading-snug">
                    {featuredEvent.title}
                  </h3>
                  <p className="text-green-300 text-sm mb-1">📍 {featuredEvent.location}</p>
                  {!liveAuction && upcomingAuction?.auction_date && (
                    <p className="text-gray-400 text-sm">
                      📅 {new Date(upcomingAuction.auction_date).toLocaleDateString('en-IN', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })} · {new Date(upcomingAuction.auction_date).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit',
                      })} IST
                    </p>
                  )}
                  {featuredEvent.agent_name && (
                    <p className="text-gray-400 text-xs mt-1">
                      Agent: {featuredEvent.agent_name}
                      {featuredEvent.agent_phone ? ` · ${featuredEvent.agent_phone}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  {liveAuction ? (
                    <button
                      onClick={() => navigate(`/auctions/${liveAuction.id}`)}
                      className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors whitespace-nowrap"
                    >
                      🔨 Join Now
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate('/register')}
                        className="border border-white/60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/10 transition-colors whitespace-nowrap"
                      >
                        Register
                      </button>
                      <button
                        onClick={() => navigate(`/auctions/${upcomingAuction.id}`)}
                        className="bg-white text-[#1a3a1a] px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors whitespace-nowrap"
                      >
                        View Details →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 5: HOW IT WORKS ──────────────── */}
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
