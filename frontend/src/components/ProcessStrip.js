import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { GALLERY_CATEGORIES, optimizedImageUrl } from '@/lib/gallery';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// "From source to dispatch" — one step per gallery category, each showing that
// category's featured image. A step with no featured image is skipped, and the
// whole strip disappears if nothing is featured yet.
const ProcessStrip = ({ className = '' }) => {
  const [featured, setFeatured] = useState({});

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/gallery`, { params: { featured: true } })
      .then((res) => {
        if (cancelled) return;
        const byCategory = {};
        res.data.forEach((item) => {
          if (item.media_type === 'image') byCategory[item.category] = item;
        });
        setFeatured(byCategory);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const steps = GALLERY_CATEGORIES.filter((c) => featured[c.key]);
  if (steps.length === 0) return null;

  return (
    <section className={className} data-testid="process-strip">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <h2 className="font-serif text-2xl md:text-4xl text-[#1a3a1a] mb-6 text-center">From source to dispatch</h2>
        <ol className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-visible">
          {steps.map((step) => {
            const item = featured[step.key];
            return (
              <li key={step.key} className="snap-start shrink-0 w-[72%] sm:w-[45%] md:w-auto">
                <div className="bg-white rounded-xl overflow-hidden border border-gray-100 h-full">
                  <div className="aspect-[4/3] bg-[#e9e4d8]">
                    <img
                      src={optimizedImageUrl(item.media_url, 600)}
                      alt={item.alt_text || ''}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-[#1a3a1a]">
                      <span className="text-[#2d5a27] mr-1">{GALLERY_CATEGORIES.findIndex((c) => c.key === step.key) + 1}.</span>
                      {step.step}
                    </p>
                    <p className="text-sm text-gray-600 mt-1 leading-snug">{step.blurb}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="text-center mt-4">
          <Link to="/gallery" className="text-[#2d5a27] text-sm font-semibold hover:underline">
            See all photos &amp; videos →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ProcessStrip;
