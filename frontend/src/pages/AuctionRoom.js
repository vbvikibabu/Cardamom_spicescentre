import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API_URL
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

// FIX 6 — Extract best image URL from a lot (updated regex)
const getLotImage = (lot) => {
  if (!lot) return null;
  const paths = lot.media_paths || [];
  const img = paths.find(url =>
    /\.(jpg|jpeg|png|webp)/i.test(url) || url.includes('/image/upload/')
  );
  if (img) return img;
  const vid = paths.find(url =>
    url.includes('/video/upload/') || /\.(mp4|mov)/i.test(url)
  );
  if (vid) return vid
    .replace('/video/upload/', '/video/upload/so_0,f_jpg,q_80/')
    .replace(/\.(mp4|mov)(\?|$)/, '.jpg$2');
  return null;
};

// FIX 4 — Calculate remaining seconds from server end_time string
const calcRemaining = (endTimeStr) => {
  if (!endTimeStr) return 0;
  const end = new Date(endTimeStr);
  const now = new Date();
  return Math.max(0, Math.floor((end - now) / 1000));
};

export default function AuctionRoom() {
  const { eventId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [lots, setLots] = useState([]);
  const [activeLot, setActiveLot] = useState(null);
  const [currentLotData, setCurrentLotData] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [initialSeconds, setInitialSeconds] = useState(45); // FIX 4 — track first server value
  const [showSold, setShowSold] = useState(false);
  const [soldData, setSoldData] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [recentBids, setRecentBids] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const pingRef = useRef(null);
  const activeLotRef = useRef(activeLot);

  useEffect(() => {
    activeLotRef.current = activeLot;
  }, [activeLot]);

  // FIX 4 — Local countdown between server syncs (1s tick)
  useEffect(() => {
    if (timeLeft > 0 && currentLotData?.lot_status === 'live') {
      timerRef.current = setTimeout(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, currentLotData?.lot_status]);

  // FIX 5 — Unified poll: runs every 6s always (lobby + live)
  const pollEventStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auction/events/${eventId}`);
      const data = res.data;
      const newLots = data.lots || [];
      setLots(newLots);

      if (!data.event && !event) {
        setEvent(data.event || null);
      }

      const liveLot = newLots.find(l => l.lot_status === 'live');

      // Lot just went live — connect and start bidding
      if (liveLot && liveLot.id !== activeLotRef.current) {
        setActiveLot(liveLot.id);
        setCurrentLotData(liveLot);
        const remaining = calcRemaining(liveLot.auction_end_time);
        setTimeLeft(remaining);
        setInitialSeconds(remaining || 45);
        toast.success('🔴 Auction is LIVE! Place your bids!');
      }

      // FIX 4 — Server time sync for active live lot (every 6s poll re-calcs time)
      if (activeLotRef.current && liveLot && liveLot.id === activeLotRef.current) {
        const remaining = calcRemaining(liveLot.auction_end_time);
        setTimeLeft(remaining);
        setCurrentLotData(prev => ({
          ...prev,
          current_price: liveLot.current_price,
          current_winner: liveLot.current_winner,
          current_winner_company: liveLot.current_winner_company,
          min_next_bid: liveLot.min_next_bid,
          total_bids: liveLot.total_bids,
        }));
      }

      // Active lot closed
      if (activeLotRef.current && !liveLot) {
        const closedLot = newLots.find(
          l => l.id === activeLotRef.current && l.lot_status !== 'live'
        );
        if (closedLot) {
          setCurrentLotData(closedLot);
          setActiveLot(null);
        }
      }
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, [eventId, event]);

  // FIX 5 — Always poll every 6s regardless of lobby/live state
  useEffect(() => {
    pollEventStatus();
    const interval = setInterval(pollEventStatus, 6000);
    return () => clearInterval(interval);
  }, [pollEventStatus]);

  const handleWSMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'connected':
        setCurrentLotData(prev => ({
          ...prev,
          lot_status: msg.lot_status,
          current_price: msg.current_price,
        }));
        if (msg.seconds_remaining) {
          setTimeLeft(msg.seconds_remaining);
          setInitialSeconds(msg.seconds_remaining);
        }
        if (msg.viewer_count !== undefined) setViewerCount(msg.viewer_count);
        break;

      case 'bid_update':
        setCurrentLotData(prev => ({
          ...prev,
          current_price: msg.current_price,
          current_winner: msg.current_winner,
          current_winner_company: msg.current_winner_company,
          min_next_bid: msg.min_next_bid,
          total_bids: msg.total_bids,
        }));
        // FIX 3 — sync initialSeconds on every bid so progress bar doesn't jump
        if (msg.end_time) {
          const remaining = calcRemaining(msg.end_time);
          setTimeLeft(remaining);
          setInitialSeconds(prev => Math.max(prev, remaining));
        } else if (msg.seconds_remaining) {
          setTimeLeft(msg.seconds_remaining);
          setInitialSeconds(prev => Math.max(prev, msg.seconds_remaining));
        }
        if (msg.viewer_count !== undefined) setViewerCount(msg.viewer_count);
        setRecentBids(prev => [{
          bidder: msg.bidder_display,
          amount: msg.current_price,
          time: new Date().toLocaleTimeString('en-IN'),
        }, ...prev].slice(0, 10));
        toast.success(`New bid: ₹${msg.current_price?.toLocaleString('en-IN')}/kg`);
        break;

      case 'lot_started':
        // FIX 4 — use end_time for accurate server-derived initial value
        {
          const remaining = msg.end_time
            ? calcRemaining(msg.end_time)
            : (msg.seconds_remaining || 45);
          setTimeLeft(remaining);
          setInitialSeconds(remaining);
        }
        setCurrentLotData(msg);
        setShowSold(false);
        setSoldData(null);
        setBidAmount(String((msg.starting_price || 0) + (msg.bid_increment || 10)));
        toast.info(`🔴 Auction started for ${msg.product_name}!`);
        break;

      case 'lot_sold':
        setShowSold(true);
        setSoldData(msg);
        setTimeLeft(0);
        clearTimeout(timerRef.current);
        setCurrentLotData(prev => ({ ...prev, lot_status: 'sold' }));
        toast.success(`SOLD! ${msg.product_name} to ${msg.winner_name}`);
        setTimeout(() => {
          setShowSold(false);
          setActiveLot(null);
        }, 8000);
        break;

      case 'lot_unsold':
        setCurrentLotData(prev => ({ ...prev, lot_status: 'unsold' }));
        toast.error(`${msg.product_name} — No bids received`);
        setTimeout(() => setActiveLot(null), 3000);
        break;

      case 'timer_warning':
        // FIX 4 — prefer end_time calculation
        if (msg.end_time) {
          setTimeLeft(calcRemaining(msg.end_time));
        } else {
          setTimeLeft(msg.seconds_remaining);
        }
        break;

      case 'viewer_update':
        setViewerCount(msg.viewer_count);
        break;

      default:
        break;
    }
  }, []);

  const connectWS = useCallback((lotId) => {
    if (wsRef.current) wsRef.current.close();
    clearInterval(pingRef.current);

    const ws = new WebSocket(`${WS_URL}/ws/auction/${lotId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (e) => {
      try { handleWSMessage(JSON.parse(e.data)); } catch {}
    };

    ws.onclose = () => {
      setWsConnected(false);
      clearInterval(pingRef.current);
      setTimeout(() => {
        if (activeLotRef.current) connectWS(activeLotRef.current);
      }, 3000);
    };

    ws.onerror = () => setWsConnected(false);
  }, [handleWSMessage]);

  // Load event on mount
  useEffect(() => {
    axios.get(`${API_URL}/api/auction/events/${eventId}`)
      .then(r => {
        setEvent(r.data.event);
        setLots(r.data.lots || []);
        const liveLot = (r.data.lots || []).find(l => l.lot_status === 'live');
        if (liveLot) {
          setActiveLot(liveLot.id);
          setCurrentLotData(liveLot);
          const remaining = calcRemaining(liveLot.auction_end_time);
          setTimeLeft(remaining);
          setInitialSeconds(remaining || 45);
        }
      })
      .catch(console.error);
  }, [eventId]);

  // Connect WS when active lot changes
  useEffect(() => {
    if (!activeLot) return;
    connectWS(activeLot);
    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(timerRef.current);
      clearInterval(pingRef.current);
    };
  }, [activeLot, connectWS]);

  const placeBid = async () => {
    if (!user || !token) {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      navigate('/login');
      return;
    }
    // FIX 4 — Hard block when timer is 0 or lot not live
    if (timeLeft === 0 || currentLotData?.lot_status !== 'live') {
      toast.error('Bidding is closed for this lot');
      return;
    }
    const amount = parseFloat(bidAmount);
    if (!amount || isNaN(amount)) { toast.error('Enter a valid bid amount'); return; }
    const minBid = currentLotData?.min_next_bid || 0;
    if (amount < minBid) {
      toast.error(`Minimum bid is ₹${minBid?.toLocaleString('en-IN')}/kg`);
      return;
    }

    setBidding(true);
    try {
      await axios.post(
        `${API_URL}/api/auction/lots/${activeLot}/bid`,
        { bid_amount: amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Bid placed! 🎉');
      setBidAmount(String(amount + (currentLotData?.bid_increment || 10)));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bid failed');
    } finally {
      setBidding(false);
    }
  };

  // FIX 4 — Progress bar uses initialSeconds (no hardcoded 30/45)
  const timerColor = timeLeft <= 10 ? 'bg-red-600' : timeLeft <= 20 ? 'bg-amber-500' : 'bg-[#2d5a27]';
  const timerText  = timeLeft === 0 ? 'Bidding Closed' : timeLeft <= 5 ? 'Going twice...' : timeLeft <= 10 ? 'Going once...' : 'Time Remaining';
  const progressPct = initialSeconds > 0 ? Math.min(100, (timeLeft / initialSeconds) * 100) : 0;
  const isLiveBidding = currentLotData?.lot_status === 'live' && timeLeft > 0;

  const lotImage = getLotImage(currentLotData);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#1a3a1a] flex items-center justify-center pt-20">
        <div className="text-white text-center">
          <div className="animate-spin text-4xl mb-4">🌿</div>
          <p>Loading auction room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a3a1a] pb-24 md:pb-0 pt-20 relative">

      {/* SOLD overlay — 8 seconds */}
      {showSold && soldData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
          <div className="bg-white rounded-2xl p-8 text-center mx-4 max-w-sm w-full animate-bounce shadow-2xl">
            <div className="text-6xl mb-3">🔨</div>
            <h2 className="text-4xl font-bold text-[#2d5a27] mb-1">SOLD!</h2>
            <p className="text-2xl font-bold text-gray-800 mb-3">
              ₹{soldData.final_price?.toLocaleString('en-IN')}/kg
            </p>
            <div className="bg-green-50 rounded-xl px-5 py-3 mb-3">
              <p className="text-xs text-green-600 uppercase tracking-wider font-semibold mb-1">Winner</p>
              <p className="text-lg font-bold text-[#2d5a27]">{soldData.winner_name}</p>
              {soldData.winner_company && (
                <p className="text-sm text-gray-500">{soldData.winner_company}</p>
              )}
            </div>
            <p className="text-green-600 font-semibold text-sm">🎉 Congratulations!</p>
            <p className="text-gray-400 text-xs mt-2">{soldData.product_name}</p>
          </div>
        </div>
      )}

      {/* FIX 8 — Top bar: tighter, truncate, no overflow */}
      <div className="bg-[#0d2a0d] px-3 py-2 flex justify-between items-center overflow-hidden gap-2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-green-300 text-[10px] font-bold tracking-wider uppercase">Live Auction</p>
          <p className="text-white font-semibold text-sm truncate">{event.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-green-300 text-xs truncate max-w-28">📍 {event.location}</p>
            <p className="text-gray-400 text-xs">👥 {viewerCount} watching</p>
          </div>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        </div>
      </div>

      {/* Live lot view */}
      {currentLotData?.lot_status === 'live' ? (
        <div className="px-4 py-4 max-w-lg mx-auto space-y-3">

          {/* Lot header card — FIX 4 full details */}
          <div className="bg-[#0d2a0d] rounded-xl p-4">
            <div className="flex justify-between text-green-300 text-xs mb-2">
              <span>LOT {currentLotData.lot_number || '–'}</span>
              <span>{currentLotData.total_bids || 0} bids</span>
            </div>
            {/* Lot image */}
            {lotImage && (
              <img
                src={lotImage}
                alt={currentLotData.product_name}
                className="w-full rounded-lg mt-1 mb-3"
                style={{ height: '180px', objectFit: 'cover' }}
                onError={e => e.target.style.display = 'none'}
              />
            )}
            <h2 className="text-white text-lg font-serif font-bold mb-0.5 truncate">{currentLotData.product_name}</h2>
            {/* FIX 4 — 2×2 detail grid */}
            <div className="grid grid-cols-2 gap-1.5 mt-3">
              <div className="bg-[#1a4a1a] rounded-lg px-2.5 py-2">
                <p className="text-green-400 text-[9px] uppercase tracking-wider mb-0.5">Grade</p>
                <p className="text-white text-xs font-semibold">{currentLotData.grade || '—'}</p>
              </div>
              <div className="bg-[#1a4a1a] rounded-lg px-2.5 py-2">
                <p className="text-green-400 text-[9px] uppercase tracking-wider mb-0.5">Quantity</p>
                <p className="text-white text-xs font-semibold">{currentLotData.quantity_kg} kg</p>
              </div>
              <div className="bg-[#1a4a1a] rounded-lg px-2.5 py-2">
                <p className="text-green-400 text-[9px] uppercase tracking-wider mb-0.5">Starting Price</p>
                <p className="text-white text-xs font-semibold">₹{currentLotData.starting_price?.toLocaleString('en-IN')}/kg</p>
              </div>
              <div className="bg-[#1a4a1a] rounded-lg px-2.5 py-2">
                <p className="text-green-400 text-[9px] uppercase tracking-wider mb-0.5">Min Increment</p>
                <p className="text-white text-xs font-semibold">₹{currentLotData.bid_increment}</p>
              </div>
            </div>
            {/* Description */}
            {currentLotData.description && (
              <p className="text-gray-400 text-xs mt-3 leading-relaxed line-clamp-2">{currentLotData.description}</p>
            )}
            {/* Seller info */}
            {(currentLotData.seller_name || currentLotData.seller_company) && (
              <p className="text-gray-500 text-xs mt-2">
                Seller: {currentLotData.seller_name || ''}{currentLotData.seller_company ? ` · ${currentLotData.seller_company}` : ''}
              </p>
            )}
          </div>

          {/* Current bid — FIX 8 */}
          <div className="bg-white rounded-xl p-4 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Current Bid</p>
            <p className="text-3xl md:text-4xl font-bold text-[#2d5a27] mb-1">
              ₹{currentLotData.current_price?.toLocaleString('en-IN')}/kg
            </p>
            <p className="text-gray-600 text-sm truncate">
              {currentLotData.current_winner || 'No bids yet'}
              {currentLotData.current_winner_company ? ` · ${currentLotData.current_winner_company}` : ''}
            </p>
          </div>

          {/* Countdown timer — FIX 4 progress bar uses initialSeconds, FIX 8 */}
          <div className={`${timerColor} rounded-xl p-4 text-center transition-colors duration-500`}>
            <p className="text-white/70 text-xs uppercase tracking-wider mb-1">{timerText}</p>
            <p className={`text-white font-bold font-mono text-4xl md:text-5xl ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
            {/* FIX 4 — no hardcoded 30/45: uses initialSeconds */}
            <div className="mt-2 bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-1000 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Bid input — FIX 8 mobile layout */}
          {user ? (
            <div className="bg-white rounded-xl p-4">
              <p className="text-gray-500 text-[11px] mb-2 text-center">
                Min: ₹{currentLotData.min_next_bid?.toLocaleString('en-IN')}/kg
                {' '}(+₹{currentLotData.bid_increment} increment)
              </p>
              {isLiveBidding ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    placeholder={`Min ₹${currentLotData.min_next_bid}`}
                    className="flex-1 min-w-0 border-2 border-[#2d5a27] rounded-lg px-3 py-3 text-lg font-bold text-center focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); placeBid(); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); placeBid(); } }}
                    disabled={bidding}
                    className="w-20 flex-shrink-0 bg-[#2d5a27] text-white px-2 py-3 rounded-lg font-bold text-sm disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    {bidding ? '...' : '🔨 BID'}
                  </button>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg py-3 text-center">
                  <p className="text-red-600 font-bold text-sm">⏹ Bidding Closed</p>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full bg-[#2d5a27] text-white py-4 rounded-xl font-bold text-lg"
            >
              Login to Place Bids
            </button>
          )}

          {/* Bid history */}
          {recentBids.length > 0 && (
            <div className="bg-[#0d2a0d] rounded-xl p-4">
              <p className="text-green-300 text-xs uppercase tracking-wider mb-3">Bid History</p>
              <div className="space-y-2">
                {recentBids.slice(0, 5).map((bid, i) => (
                  <div key={i} className="flex justify-between items-center gap-2">
                    <span className="text-gray-400 text-xs truncate max-w-[80px]">{bid.bidder}</span>
                    <span className={`font-bold flex-shrink-0 ${i === 0 ? 'text-white text-base' : 'text-gray-400 text-sm'}`}>
                      ₹{bid.amount?.toLocaleString('en-IN')}
                    </span>
                    <span className="text-gray-500 text-[10px] flex-shrink-0">{bid.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      ) : (
        /* FIX 2 — Lobby/waiting view — auto-detects live every 6s */
        <div className="px-4 py-6 max-w-lg mx-auto">
          {/* FIX 2 — All lots done → Auction Completed screen */}
          {lots.length > 0 && lots.every(l => ['sold', 'unsold'].includes(l.lot_status)) ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-white text-2xl font-bold mb-2">Auction Completed!</h2>
              <p className="text-green-300 text-sm mb-1">All {lots.length} lot{lots.length !== 1 ? 's' : ''} have been auctioned.</p>
              <p className="text-gray-400 text-xs mb-8">Thank you for participating.</p>
              <button
                type="button"
                onClick={() => navigate('/auctions')}
                className="bg-[#2d5a27] text-white px-8 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Browse More Auctions →
              </button>
            </div>
          ) : (
            <>
          <div className="text-center mb-5">
            <p className="text-green-300 text-sm">
              {lots.filter(l => l.lot_status === 'approved').length > 0
                ? `⏳ ${lots.filter(l => l.lot_status === 'approved').length} lots queued — waiting for admin to start`
                : 'Waiting for auction to begin...'}
            </p>
            <p className="text-gray-500 text-xs mt-1">Page updates automatically every 6 seconds</p>
          </div>
          <div className="space-y-3">
            {lots.map(lot => {
              const thumbImg = getLotImage(lot);
              return (
                <div
                  key={lot.id}
                  onClick={() => {
                    if (lot.lot_status === 'live') {
                      setActiveLot(lot.id);
                      setCurrentLotData(lot);
                    }
                  }}
                  className={`rounded-xl p-4 border ${
                    lot.lot_status === 'live'
                      ? 'bg-white border-green-500 cursor-pointer'
                      : lot.lot_status === 'sold'
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-[#0d2a0d] border-gray-700'
                  }`}
                >
                  {lot.lot_status === 'sold' ? (
                    <div>
                      <div className="flex items-start gap-3 mb-2">
                        {thumbImg && (
                          <img
                            src={thumbImg}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 opacity-60"
                            onError={e => e.target.style.display = 'none'}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">LOT {lot.lot_number}</p>
                          <p className="font-semibold text-gray-400 text-sm truncate">{lot.product_name}</p>
                          <p className="text-gray-500 text-xs">{lot.grade} · {lot.quantity_kg} kg</p>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-900/60 text-green-300 flex-shrink-0">✅ SOLD</span>
                      </div>
                      <div className="bg-green-900/30 rounded-lg px-3 py-2">
                        <p className="text-green-300 text-base font-bold">
                          ₹{(lot.sold_price || lot.current_price)?.toLocaleString('en-IN')}/kg
                        </p>
                        {lot.current_winner_name && (
                          <>
                            <p className="text-white text-sm font-semibold">Winner: {lot.current_winner_name}</p>
                            {lot.current_winner_company && (
                              <p className="text-gray-400 text-xs">{lot.current_winner_company}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {/* FIX 6 — thumbnail in lobby */}
                      {thumbImg && (
                        <img
                          src={thumbImg}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          onError={e => e.target.style.display = 'none'}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">LOT {lot.lot_number}</p>
                        <p className={`font-semibold text-sm truncate ${lot.lot_status === 'live' ? 'text-gray-800' : 'text-white'}`}>
                          {lot.product_name}
                        </p>
                        <p className={`text-xs truncate ${lot.lot_status === 'live' ? 'text-gray-600' : 'text-gray-400'}`}>
                          {lot.grade} · {lot.quantity_kg} kg
                        </p>
                        {lot.lot_status === 'live' && lot.current_price && (
                          <p className="text-green-700 text-xs font-bold mt-0.5">
                            Current: ₹{lot.current_price?.toLocaleString('en-IN')}/kg
                          </p>
                        )}
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ${
                        lot.lot_status === 'live'
                          ? 'bg-red-500 text-white animate-pulse'
                          : lot.lot_status === 'unsold'
                          ? 'bg-gray-700 text-gray-400'
                          : lot.lot_status === 'approved'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {lot.lot_status === 'live'    ? '🔴 LIVE'
                          : lot.lot_status === 'approved' ? 'NEXT'
                          : lot.lot_status === 'unsold'   ? '❌'
                          : lot.lot_status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {lots.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-4">🌿</p>
                <p className="text-green-300">No lots registered yet</p>
                <p className="text-gray-500 text-sm mt-2">Check back soon</p>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
