import { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, X } from 'lucide-react';
import { useDocumentHead } from '@/hooks/useDocumentHead';
import { categoryLabel, optimizedImageUrl, optimizedVideoUrl } from '@/lib/gallery';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Gallery = () => {
  useDocumentHead({
    title: 'Cardamom Sourcing, Grading & Packing — Photos & Videos | Cardamom Spices Centre',
    description: 'Photos and videos of green cardamom sourcing, grading, sampling, packing and dispatch from Cardamom Spices Centre, Madurai.',
    path: '/gallery',
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    axios.get(`${API}/gallery`)
      .then((res) => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="min-h-screen bg-[#f5f0e8] pb-20 md:pb-0 pt-32">
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1a3a1a]">Photos &amp; Videos</h1>
        <p className="text-gray-600 mt-2">Sourcing, grading, sampling, packing and dispatch.</p>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 pb-12">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-gray-500 py-16 text-center">Photos and videos are coming soon.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setOpen(item)}
                className="relative aspect-square overflow-hidden rounded-xl bg-[#e9e4d8] text-left group"
              >
                <img
                  src={item.media_type === 'video' ? item.poster_url : optimizedImageUrl(item.media_url, 600)}
                  alt={item.alt_text || ''}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {item.media_type === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-black/55 text-white rounded-full p-3"><Play size={22} fill="currentColor" /></span>
                  </span>
                )}
                <span className="absolute top-2 left-2 bg-white/90 text-[#1a3a1a] text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full">
                  {categoryLabel(item.category)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center p-4"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
        >
          <button type="button" aria-label="Close" className="absolute top-4 right-4 text-white p-2" onClick={() => setOpen(null)}>
            <X size={28} />
          </button>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {open.media_type === 'video' ? (
              // Mounted only after a tap, so nothing downloads until the visitor asks for it.
              // Starts muted (no autoplay with sound); the controls let them unmute.
              <video
                src={optimizedVideoUrl(open.media_url)}
                poster={open.poster_url}
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                className="w-full max-h-[75vh] rounded-lg bg-black"
              />
            ) : (
              <img
                src={optimizedImageUrl(open.media_url, 1600)}
                alt={open.alt_text || ''}
                className="w-full max-h-[75vh] object-contain rounded-lg"
              />
            )}
            {open.caption && <p className="text-white text-center mt-3 text-sm md:text-base">{open.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
