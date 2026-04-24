import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API_URL
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

// FIX 3 — Extract best image URL from a lot
const getLotImage = (lot) => {
  if (!lot) return null;
  if (lot.media_paths?.length > 0) {
    const img = lot.media_paths.find(url =>
      /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) ||
      url.includes('/image/upload/')
    );
    if (img) return img;
    const vid = lot.media_paths.find(url => url.includes('/video/upload/'));
    if (vid) return vid
      .replace('/video/upload/', '/video/upload/so_0,f_jpg,q_80/')
      .replace(/\.(mp4|mov)$/, '.jpg');
  }
  return null;
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

  // ── Fetch lot status from server (source of truth) ──
  const fetchLotStatus = useCallback(async (lotId) => {
    if (!lotId) return;
    try {
      const res = await axios.get(`${API_URL}/api/auction/lots/${lotId}/live`);
      const data = res.data;
      setCurrentLotData(data);
      // FIX 1 — calculate time from server's end_time, not seconds_remaining
      if (data.end_time) {
        const serverEnd = new Date(data.end_time);
        const now = new Date();
        const remaining = Math.max(0, Math.floor((serverEnd - now) / 1000));
        setTimeLeft(remaining);
      } else {
        setTimeLeft(data.seconds_remaining || 0);
      }
      setRecentBids(data.recent_bids || []);
      setViewerCount(data.viewer_count || 0);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // FIX 1 — Server timer sync every 5 seconds while lot is live
  useEffect(() => {
    if (!activeLot) return;

    const syncTimer = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auction/lots/${activeLot}/live`);
        const data = res.data;

        if (data.lot_status !== 'live') {
          clearInterval(syncTimer);
          setCurrentLotData(data);
          return;
        }

        if (data.end_time) {
          const serverEnd = new Date(data.end_time);
          const now = new Date();
          const remaining = Math.max(0, Math.floor((serverEnd - now) / 1000));
          setTimeLeft(remaining);
        }

        setCurrentLotData(prev => ({
          ...prev,
          current_price: data.current_price,
          current_winner: data.current_winner,
          current_winner_company: data.current_winner_company,
          min_next_bid: data.min_next_bid,
          total_bids: data.total_bids,
        }));
      } catch (e) {
        console.error('Timer sync error:', e);
      }
    }, 5000);

    return () => clearInterval(syncTimer);
  }, [activeLot]);

  const handleWSMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'connected':
        setCurrentLotData(prev => ({
          ...prev,
          lot_status: msg.lot_status,
          current_price: msg.current_price,
          seconds_remaining: msg.seconds_remaining,
        }));
        if (msg.seconds_remaining) setTimeLeft(msg.seconds_remaining);
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
        // Use server's seconds_remaining from the message
        if (msg.seconds_remaining) setTimeLeft(msg.seconds_remaining);
        if (msg.viewer_count !== undefined) setViewerCount(msg.viewer_count);
        setRecentBids(prev => [{
          bidder: msg.bidder_display,
          amount: msg.current_price,
          time: new Date().toLocaleTimeString('en-IN'),
        }, ...prev].slice(0, 10));
        toast.success(`New bid: ₹${msg.current_price?.toLocaleString('en-IN')}/kg`);
        break;

      case 'lot_started':
        setCurrentLotData(msg);
        setTimeLeft(msg.seconds_remaining || 45);
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
          fetchLotStatus(activeLotRef.current);
        }, 8000);
        break;

      case 'lot_unsold':
        setCurrentLotData(prev => ({ ...prev, lot_status: 'unsold' }));
        toast.error(`${msg.product_name} — No bids received`);
        setTimeout(() => fetchLotStatus(activeLotRef.current), 3000);
        break;

      case 'timer_warning':
        // FIX 1 — always use server value
        setTimeLeft(msg.seconds_remaining);
        break;

      case 'viewer_update':
        setViewerCount(msg.viewer_count);
        break;

      default:
        break;
    }
  }, [fetchLotStatus]);

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

  // Load event + lots on mount
  useEffect(() => {
    axios.get(`${API_URL}/api/auction/events/${eventId}`)
      .then(r => {
        setEvent(r.data.event);
        setLots(r.data.lots);
        const liveLot = r.data.lots.find(l => l.lot_status === 'live');
        if (liveLot) {
          setActiveLot(liveLot.id);
          setCurrentLotData(liveLot);
        }
      })
      .catch(console.error);
  }, [eventId]);

  // Connect WS + fetch status when active lot changes
  useEffect(() => {
    if (!activeLot) return;
    connectWS(activeLot);
    fetchLotStatus(activeLot);
    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(timerRef.current);
      clearInterval(pingRef.current);
    };
  }, [activeLot, connectWS, fetchLotStatus]);

  // FIX 1 — Local countdown between server syncs (every 1s)
  useEffect(() => {
    if (timeLeft > 0 && currentLotData?.lot_status === 'live') {
      timerRef.current = setTimeout(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, currentLotData?.lot_status]);

  // FIX 2 — Poll for lot going live when in lobby (every 8s)
  const pollForLiveLot = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auction/events/${eventId}`);
      const liveLot = res.data.lots.find(l => l.lot_status === 'live');
      if (liveLot && liveLot.id !== activeLotRef.current) {
        setActiveLot(liveLot.id);
        setCurrentLotData(liveLot);
        toast.success('🔴 Auction is LIVE! Place your bids!');
      }
      setLots(res.data.lots);
    } catch (e) {
      console.error(e);
    }
  }, [eventId]);

  useEffect(() => {
    if (activeLot) return;
    const interval = setInterval(pollForLiveLot, 5000);
    return () => clearInterval(interval);
  }, [activeLot, pollForLiveLot]);

  const placeBid = async () => {
    if (!user || !token) {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      navigate('/login');
      return;
    }
    // FIX 1 — Hard block when timer is 0 or lot not live
    if (timeLeft === 0 || currentLotData?.lot_status !== 'live') {
      toast.error('Bidding is closed for this lot');
      return;
    }
    const amount = parseFloat(bidAmount);
    if (!amount || isNaN(amount)) { toast.error('Enter a valid bid amount'); return; }
    const minBid = currentLotData?.min_next_bid || 0;
    if (amount < minBid) { toast.error(`Minimum bid is ₹${minBid?.toLocaleString('en-IN')}/kg`); return; }

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

  const timerColor = timeLeft <= 10 ? 'bg-red-600' : timeLeft <= 20 ? 'bg-amber-500' : 'bg-[#2d5a27]';
  const timerText = timeLeft === 0 ? 'Bidding Closed' : timeLeft <= 5 ? 'Going twice...' : timeLeft <= 10 ? 'Going once...' : 'Time Remaining';
  const bidWindowSeconds = currentLotData?.bid_window_seconds || 45;
  const isLiveBidding = currentLotData?.lot_status === 'live' && timeLeft > 0;

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

  const lotImage = getLotImage(currentLotData);

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

      {/* FIX 7 — Top bar: tighter, no overflow */}
      <div className="bg-[#0d2a0d] px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-green-300 text-[10px] font-bold tracking-wider uppercase">Live Auction</p>
          <p className="text-white font-semibold text-sm truncate">{event.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-green-300 text-[10px] truncate max-w-28">📍 {event.location}</p>
            <p className="text-gray-400 text-[10px]">👥 {viewerCount} watching</p>
          </div>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        </div>
      </div>

      {/* Live lot view */}
      {currentLotData?.lot_status === 'live' ? (
        <div className="px-4 py-4 max-w-lg mx-auto space-y-3">

          {/* FIX 7 — Lot header card */}
          <div className="bg-[#0d2a0d] rounded-xl p-4">
            <div className="flex justify-between text-green-300 text-xs mb-2">
              <span>LOT {currentLotData.lot_number || '–'}</span>
              <span>{currentLotData.total_bids || 0} bids</span>
            </div>
            {/* FIX 3 — Lot image */}
            {lotImage && (
              <img
                src={lotImage}
                alt={currentLotData.product_name}
                className="w-full h-40 object-cover rounded-lg mb-3"
              />
            )}
            <h2 className="text-white text-lg font-serif font-bold mb-0.5 truncate">{currentLotData.product_name}</h2>
            <p className="text-green-300 text-xs truncate">{currentLotData.grade} · {currentLotData.quantity_kg} kg</p>
          </div>

          {/* Current bid — FIX 7 smaller price on mobile */}
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

          {/* Countdown timer — FIX 7 text-4xl on mobile */}
          <div className={`${timerColor} rounded-xl p-4 text-center transition-colors duration-500`}>
            <p className="text-white/70 text-xs uppercase tracking-wider mb-1">{timerText}</p>
            <p className={`text-white font-bold text-4xl md:text-5xl font-mono ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
            <div className="mt-2 bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-1000 rounded-full"
                style={{ width: `${Math.min(100, (timeLeft / bidWindowSeconds) * 100)}%` }}
              />
            </div>
          </div>

          {/* Bid input — FIX 1 blocked when timer=0, FIX 7 mobile layout */}
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
                    className="flex-1 border-2 border-[#2d5a27] rounded-lg px-3 py-3 text-lg font-bold text-center focus:outline-none"
                  />
                  <button
                    onClick={placeBid}
                    disabled={bidding}
                    className="bg-[#2d5a27] text-white px-4 py-3 rounded-lg font-bold text-base disabled:opacity-50 active:scale-95 transition-transform w-20"
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
              onClick={() => navigate('/login')}
              className="w-full bg-[#2d5a27] text-white py-4 rounded-xl font-bold text-lg"
            >
              Login to Place Bids
            </button>
          )}

          {/* Bid history — FIX 7 max 5 items, truncate bidder name */}
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
        /* FIX 2 — Lobby/waiting view with polling */
        <div className="px-4 py-6 max-w-lg mx-auto">
          <div className="text-center mb-5">
            <p className="text-green-300 text-sm">
              {lots.filter(l => l.lot_status === 'approved').length > 0
                ? `⏳ ${lots.filter(l => l.lot_status === 'approved').length} lots queued — waiting for admin to start`
                : 'Waiting for auction to begin...'}
            </p>
            <p className="text-gray-500 text-xs mt-1">Page updates automatically every 8 seconds</p>
          </div>
          <div className="space-y-3">
            {lots.map(lot => {
              const thumbImg = getLotImage(lot); // FIX 3 — thumbnails in lobby
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
                          <img src={thumbImg} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 opacity-60" />
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
                      {thumbImg && (
                        <img src={thumbImg} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
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
                        {lot.lot_status === 'live' ? '🔴 LIVE'
                          : lot.lot_status === 'approved' ? 'NEXT'
                          : lot.lot_status === 'unsold' ? '❌'
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
        </div>
      )}
    </div>
  );
}
