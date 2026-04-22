import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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

export default function AuctionList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API_URL}/api/auction/events/upcoming`)
      .then(r => setEvents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
            {events.map(event => (
              <div
                key={event.id}
                className="bg-white rounded-xl p-5 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
