import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusColors = {
  upcoming: 'bg-blue-100 text-blue-800',
  registration_open: 'bg-green-100 text-green-800',
  live: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const statusLabels = {
  upcoming: 'Upcoming',
  registration_open: 'Registration Open',
  live: '🔴 LIVE NOW',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const GRADES = ['Premium', 'Grade A', 'Grade B', 'Mixed', 'Other'];

const emptyForm = () => ({
  product_name: 'Green Cardamom',
  grade: 'Premium',
  quantity_kg: '',
  starting_price: '',
  bid_increment: '10',
  currency: 'INR',
  description: '',
});

export default function AuctionList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, token, isSeller, isAuthenticated } = useAuth();

  // Per-event form state: { [eventId]: { open, form, mediaFiles, uploading, submitting } }
  const [regState, setRegState] = useState({});
  const fileInputRefs = useRef({});

  const canRegisterLot = isAuthenticated && (
    user?.role === 'seller' || user?.role === 'both'
  ) && user?.status === 'approved';

  useEffect(() => {
    axios.get(`${API_URL}/api/auction/events/upcoming`)
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getRegState = (eventId) => regState[eventId] || {
    open: false,
    form: emptyForm(),
    mediaFiles: [],   // [{ file, url, uploading }]
    submitting: false,
  };

  const setEventReg = (eventId, patch) => {
    setRegState(prev => ({
      ...prev,
      [eventId]: { ...getRegState(eventId), ...prev[eventId], ...patch },
    }));
  };

  const toggleForm = (eventId) => {
    const cur = getRegState(eventId);
    setEventReg(eventId, { open: !cur.open });
  };

  const updateForm = (eventId, field, value) => {
    const cur = getRegState(eventId);
    setEventReg(eventId, { form: { ...cur.form, [field]: value } });
  };

  const handleFileChange = async (eventId, files) => {
    const cur = getRegState(eventId);
    const remaining = 4 - cur.mediaFiles.length;
    const toUpload = Array.from(files).slice(0, remaining);

    // Add placeholders
    const placeholders = toUpload.map(f => ({ file: f, url: null, uploading: true }));
    setEventReg(eventId, { mediaFiles: [...cur.mediaFiles, ...placeholders] });

    // Upload each
    for (let i = 0; i < toUpload.length; i++) {
      const f = toUpload[i];
      const fd = new FormData();
      fd.append('file', f);
      try {
        const res = await axios.post(`${API_URL}/api/upload`, fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        setRegState(prev => {
          const s = prev[eventId] || {};
          const mf = [...(s.mediaFiles || [])];
          const idx = mf.findIndex(x => x.file === f);
          if (idx !== -1) mf[idx] = { ...mf[idx], url: res.data.url, uploading: false };
          return { ...prev, [eventId]: { ...s, mediaFiles: mf } };
        });
      } catch {
        toast.error(`Failed to upload ${f.name}`);
        setRegState(prev => {
          const s = prev[eventId] || {};
          const mf = (s.mediaFiles || []).filter(x => x.file !== f);
          return { ...prev, [eventId]: { ...s, mediaFiles: mf } };
        });
      }
    }
  };

  const removeMedia = (eventId, idx) => {
    setRegState(prev => {
      const s = prev[eventId] || {};
      const mf = [...(s.mediaFiles || [])];
      mf.splice(idx, 1);
      return { ...prev, [eventId]: { ...s, mediaFiles: mf } };
    });
  };

  const submitLot = async (eventId) => {
    const cur = getRegState(eventId);
    const { form, mediaFiles } = cur;

    if (!form.quantity_kg || !form.starting_price) {
      toast.error('Please fill in quantity and starting price');
      return;
    }
    if (mediaFiles.length === 0) {
      toast.error('Please upload at least 1 photo of the lot');
      return;
    }
    if (mediaFiles.some(f => f.uploading)) {
      toast.error('Please wait for uploads to finish');
      return;
    }

    setEventReg(eventId, { submitting: true });
    try {
      await axios.post(
        `${API_URL}/api/auction/lots`,
        {
          auction_event_id: eventId,
          product_name: form.product_name,
          grade: form.grade,
          quantity_kg: parseFloat(form.quantity_kg),
          starting_price: parseFloat(form.starting_price),
          bid_increment: parseFloat(form.bid_increment) || 10,
          currency: form.currency,
          description: form.description,
          media_paths: mediaFiles.map(f => f.url).filter(Boolean),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Lot registered! Admin will approve before auction starts.');
      setEventReg(eventId, { open: false, form: emptyForm(), mediaFiles: [], submitting: false });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to register lot');
      setEventReg(eventId, { submitting: false });
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] pb-24 md:pb-0 pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-amber-700 text-xs font-semibold tracking-widest uppercase mb-2">
            LIVE TRADING
          </p>
          <h1 className="text-4xl font-serif text-[#1a3a1a] mb-2">Cardamom Auctions</h1>
          <p className="text-gray-600 text-sm">
            Spiceboard-style live digital auctions for Bodinayakanur traders
          </p>
        </div>

        {/* How it works */}
        <div className="bg-[#2d5a27] rounded-xl p-4 mb-8 text-white">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔨</span>
            <div>
              <p className="font-semibold mb-1">How it works</p>
              <div className="text-sm text-green-100 space-y-1">
                <p>1. Register as buyer or seller</p>
                <p>2. Sellers submit lots before deadline</p>
                <p>3. Join auction room on event day</p>
                <p>4. Bid live — highest bid wins!</p>
                <p>5. Timer resets on every new bid</p>
              </div>
            </div>
          </div>
        </div>

        {/* Event list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-32" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🌿</p>
            <p className="text-gray-600">No upcoming auctions scheduled</p>
            <p className="text-sm text-gray-400 mt-2">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(event => {
              const reg = getRegState(event.id);
              const showRegBtn = canRegisterLot && event.status === 'registration_open';

              return (
                <div key={event.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  {/* Event card — clickable (but not when form is open or clicking buttons) */}
                  <div
                    className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => navigate(`/auctions/${event.id}`)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h2 className="text-lg font-serif text-[#1a3a1a] font-semibold flex-1 pr-4">
                        {event.title}
                      </h2>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${statusColors[event.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[event.status] || event.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <span>📍</span>
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>👤</span>
                        <span>{event.agent_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>📅</span>
                        <span>
                          {new Date(event.auction_date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>⏰</span>
                        <span>
                          {new Date(event.auction_date).toLocaleTimeString('en-IN', {
                            hour: '2-digit', minute: '2-digit'
                          })} IST
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-400">Agent: {event.agent_phone}</p>
                      <span className="text-[#2d5a27] text-sm font-semibold">View Details →</span>
                    </div>
                  </div>

                  {/* Seller: Register My Lot button */}
                  {showRegBtn && (
                    <div className="px-5 pb-4" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleForm(event.id)}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold border-2 border-[#2d5a27] text-[#2d5a27] hover:bg-[#2d5a27] hover:text-white transition-colors"
                      >
                        {reg.open ? '✕ Cancel Registration' : '📦 Register My Lot'}
                      </button>
                    </div>
                  )}

                  {/* Inline registration form */}
                  {showRegBtn && reg.open && (
                    <div className="border-t border-gray-100 px-5 py-5 bg-green-50" onClick={e => e.stopPropagation()}>
                      <p className="text-sm font-semibold text-[#1a3a1a] mb-4">📋 Lot Registration Details</p>

                      <div className="space-y-3">
                        {/* Product name */}
                        <div>
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Product Name</label>
                          <input
                            type="text"
                            value={reg.form.product_name}
                            onChange={e => updateForm(event.id, 'product_name', e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27]"
                            placeholder="e.g. Green Cardamom"
                          />
                        </div>

                        {/* Grade + Currency row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Grade</label>
                            <select
                              value={reg.form.grade}
                              onChange={e => updateForm(event.id, 'grade', e.target.value)}
                              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27] bg-white"
                            >
                              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Currency</label>
                            <select
                              value={reg.form.currency}
                              onChange={e => updateForm(event.id, 'currency', e.target.value)}
                              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27] bg-white"
                            >
                              <option value="INR">INR (₹)</option>
                              <option value="USD">USD ($)</option>
                            </select>
                          </div>
                        </div>

                        {/* Quantity + Starting Price row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Quantity (kg)</label>
                            <input
                              type="number"
                              min="1"
                              value={reg.form.quantity_kg}
                              onChange={e => updateForm(event.id, 'quantity_kg', e.target.value)}
                              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27]"
                              placeholder="e.g. 50"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Starting Price/kg</label>
                            <input
                              type="number"
                              min="1"
                              value={reg.form.starting_price}
                              onChange={e => updateForm(event.id, 'starting_price', e.target.value)}
                              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27]"
                              placeholder="e.g. 1500"
                            />
                          </div>
                        </div>

                        {/* Bid increment */}
                        <div>
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bid Increment/kg</label>
                          <input
                            type="number"
                            min="1"
                            value={reg.form.bid_increment}
                            onChange={e => updateForm(event.id, 'bid_increment', e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27]"
                            placeholder="10"
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Description (optional)</label>
                          <textarea
                            value={reg.form.description}
                            onChange={e => updateForm(event.id, 'description', e.target.value)}
                            rows={2}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27] resize-none"
                            placeholder="Any details about quality, harvest date, etc."
                          />
                        </div>

                        {/* Photo upload */}
                        <div>
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Photos (min 1, max 4) <span className="text-red-500">*</span>
                          </label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {reg.mediaFiles.map((mf, idx) => (
                              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                {mf.uploading ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-[#2d5a27] border-t-transparent rounded-full animate-spin" />
                                  </div>
                                ) : (
                                  <img src={mf.url} alt="" className="w-full h-full object-cover" />
                                )}
                                <button
                                  onClick={() => removeMedia(event.id, idx)}
                                  className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-bl-lg flex items-center justify-center"
                                >×</button>
                              </div>
                            ))}
                            {reg.mediaFiles.length < 4 && (
                              <button
                                onClick={() => fileInputRefs.current[event.id]?.click()}
                                className="w-16 h-16 rounded-lg border-2 border-dashed border-[#2d5a27] text-[#2d5a27] flex flex-col items-center justify-center text-xs font-semibold hover:bg-green-50 transition-colors"
                              >
                                <span className="text-xl leading-none">+</span>
                                <span>Photo</span>
                              </button>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            ref={el => fileInputRefs.current[event.id] = el}
                            onChange={e => handleFileChange(event.id, e.target.files)}
                          />
                          <p className="text-xs text-gray-400 mt-1">Upload clear photos of your lot (JPG, PNG)</p>
                        </div>

                        {/* Submit */}
                        <button
                          onClick={() => submitLot(event.id)}
                          disabled={reg.submitting || reg.mediaFiles.some(f => f.uploading)}
                          className="w-full py-3 rounded-lg bg-[#2d5a27] text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
                        >
                          {reg.submitting ? 'Submitting...' : '✅ Submit Lot for Approval'}
                        </button>
                        <p className="text-xs text-gray-500 text-center">
                          Admin will review and approve your lot before the auction starts
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
