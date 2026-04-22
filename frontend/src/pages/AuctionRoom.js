import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API_URL
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

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

  const fetchLotStatus = useCallback(async (lotId) => {
    if (!lotId) return;
    try {
      const res = await axios.get(`${API_URL}/api/auction/lots/${lotId}/live`);
      setCurrentLotData(res.data);
      setTimeLeft(res.data.seconds_remaining || 0);
      setRecentBids(res.data.recent_bids || []);
      setViewerCount(res.data.viewer_count || 0);
    } catch (e) {
      console.error(e);
    }
  }, []);

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
        setTimeLeft(msg.seconds_remaining || 30);
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
        setTimeLeft(msg.seconds_remaining || 30);
        setShowSold(false);
        setSoldData(null);
        setBidAmount(String((msg.starting_price || 0) + (msg.bid_increment || 10)));
        toast.info(`Auction started for ${msg.product_name}!`);
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
        }, 5000);
        break;

      case 'lot_unsold':
        setCurrentLotData(prev => ({ ...prev, lot_status: 'unsold' }));
        toast.error(`${msg.product_name} — No bids received`);
        setTimeout(() => fetchLotStatus(activeLotRef.current), 3000);
        break;

      case 'timer_warning':
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
      try {
        handleWSMessage(JSON.parse(e.data));
      } catch {}
    };

    ws.onclose = () => {
      setWsConnected(false);
      clearInterval(pingRef.current);
      // Auto-reconnect after 3s
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

  // Client-side countdown (decrements every second)
  useEffect(() => {
    if (timeLeft > 0 && currentLotData?.lot_status === 'live') {
      timerRef.current = setTimeout(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, currentLotData?.lot_status]);

  const placeBid = async () => {
    if (!user || !token) {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      navigate('/login');
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
  const timerText = timeLeft <= 5 ? 'Going twice...' : timeLeft <= 10 ? 'Going once...' : `${timeLeft}s`;

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

      {/* SOLD overlay */}
      {showSold && soldData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white rounded-2xl p-8 text-center mx-4 max-w-sm w-full animate-bounce">
            <div className="text-6xl mb-4">🔨</div>
            <h2 className="text-3xl font-bold text-[#2d5a27] mb-2">SOLD!</h2>
            <p className="text-xl font-semibold text-gray-800 mb-1">
              ₹{soldData.final_price?.toLocaleString('en-IN')}/kg
            </p>
            <p className="text-gray-600">Winner: {soldData.winner_name}</p>
            <p className="text-gray-500 text-sm">{soldData.winner_company}</p>
            <p className="text-gray-400 text-xs mt-3">{soldData.product_name}</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="bg-[#0d2a0d] px-4 py-3 flex justify-between items-center">
        <div>
          <p className="text-green-300 text-xs font-semibold tracking-wider">LIVE AUCTION</p>
          <p className="text-white font-semibold text-sm truncate max-w-48">{event.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-green-300 text-xs">📍 {event.location}</p>
            <p className="text-gray-400 text-xs">👥 {viewerCount} watching</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        </div>
      </div>

      {/* Live lot view */}
      {currentLotData?.lot_status === 'live' ? (
        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

          {/* Lot header */}
          <div className="bg-[#0d2a0d] rounded-xl p-4 text-center">
            <div className="flex justify-between text-green-300 text-xs mb-2">
              <span>LOT {currentLotData.lot_number || '–'}</span>
              <span>{currentLotData.total_bids || 0} bids</span>
            </div>
            <h2 className="text-white text-xl font-serif font-bold mb-1">{currentLotData.product_name}</h2>
            <p className="text-green-300 text-sm">{currentLotData.grade} · {currentLotData.quantity_kg} kg</p>
          </div>

          {/* Current bid */}
          <div className="bg-white rounded-xl p-5 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Current Bid</p>
            <p className="text-4xl font-bold text-[#2d5a27] mb-1">
              ₹{currentLotData.current_price?.toLocaleString('en-IN')}/kg
            </p>
            <p className="text-gray-600 text-sm">
              {currentLotData.current_winner || 'No bids yet'}
              {currentLotData.current_winner_company ? ` · ${currentLotData.current_winner_company}` : ''}
            </p>
          </div>

          {/* Countdown timer */}
          <div className={`${timerColor} rounded-xl p-4 text-center transition-colors duration-500`}>
            <p className="text-white/70 text-xs uppercase tracking-wider mb-1">
              {timeLeft <= 10 ? timerText : 'Time Remaining'}
            </p>
            <p className={`text-white font-bold text-5xl font-mono ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
            <div className="mt-2 bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-1000 rounded-full"
                style={{ width: `${Math.min(100, (timeLeft / 30) * 100)}%` }}
              />
            </div>
          </div>

          {/* Bid input */}
          {user ? (
            <div className="bg-white rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-2 text-center">
                Min next bid: ₹{currentLotData.min_next_bid?.toLocaleString('en-IN')}/kg
                &nbsp;(+₹{currentLotData.bid_increment}/kg increment)
              </p>
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
                  disabled={bidding || timeLeft === 0}
                  className="bg-[#2d5a27] text-white px-6 py-3 rounded-lg font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform min-w-24"
                >
                  {bidding ? '...' : '🔨 BID'}
                </button>
              </div>
            </div>
          ) : (
            <button
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
                {recentBids.map((bid, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">{bid.bidder}</span>
                    <span className={`font-bold ${i === 0 ? 'text-white text-lg' : 'text-gray-400 text-sm'}`}>
                      ₹{bid.amount?.toLocaleString('en-IN')}
                    </span>
                    <span className="text-gray-500 text-xs">{bid.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      ) : (
        /* Waiting / lobby view */
        <div className="px-4 py-8 max-w-lg mx-auto">
          <div className="text-center mb-6">
            <p className="text-green-300 text-sm mb-4">
              {lots.filter(l => l.lot_status === 'approved').length} lots waiting to go live
            </p>
          </div>
          <div className="space-y-3">
            {lots.map(lot => (
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
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">LOT {lot.lot_number}</p>
                    <p className={`font-semibold ${lot.lot_status === 'sold' ? 'text-gray-400' : 'text-white'}`}>
                      {lot.product_name}
                    </p>
                    <p className="text-gray-400 text-sm">{lot.grade} · {lot.quantity_kg} kg</p>
                    {lot.lot_status === 'sold' && (
                      <p className="text-green-400 text-sm font-bold mt-1">
                        SOLD: ₹{lot.sold_price?.toLocaleString('en-IN')}/kg
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    lot.lot_status === 'live'
                      ? 'bg-red-500 text-white animate-pulse'
                      : lot.lot_status === 'sold'
                      ? 'bg-gray-600 text-gray-300'
                      : lot.lot_status === 'approved'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {lot.lot_status === 'live' ? '🔴 LIVE'
                      : lot.lot_status === 'sold' ? '✅ SOLD'
                      : lot.lot_status === 'approved' ? 'NEXT UP'
                      : lot.lot_status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}

            {lots.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-4">🌿</p>
                <p className="text-green-300">No lots registered yet</p>
                <p className="text-gray-500 text-sm mt-2">Sellers can register their lots below</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
