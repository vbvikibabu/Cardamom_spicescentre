import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Search, MessageSquare, Handshake } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useDocumentHead } from '@/hooks/useDocumentHead';
import MarketRatesPanel from '@/components/MarketRatesPanel';

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

const HOW_IT_WORKS = [
  {
    step: '01', icon: Search, title: 'Browse Grades',
    desc: "Explore our grades and see the latest Spices Board auction rates.",
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

const FAQ_GROUPS = [
  {
    heading: 'Ordering & payment',
    items: [
      {
        q: 'What are your payment terms?',
        a: 'Orders below 50kg — full payment at confirmation. Orders of 50kg and above — 30% advance to confirm, with the balance due before dispatch once your goods are packed and ready.',
      },
      {
        q: 'Is there a minimum order?',
        a: 'No. We supply from 1kg to bulk.',
      },
      {
        q: 'Can I get a sample first?',
        a: 'Yes. We send samples based on your need, so you can check the grade before ordering.',
      },
      {
        q: 'Do you provide a GST invoice?',
        a: "Yes. We're GST-registered and every order comes with a proper GST invoice.",
      },
      {
        q: "Why aren't prices listed on the website?",
        a: "Cardamom prices move daily with the auctions. We quote based on the grade, quantity and the current market, so you always get a price that reflects today's rate. You can follow the daily Spices Board auction rates here.",
        renderAnswer: () => (
          <>
            Cardamom prices move daily with the auctions. We quote based on the grade, quantity and the current market, so you always get a price that reflects today's rate. You can follow the daily Spices Board{' '}
            <Link to="/cardamom-auction-price" className="text-primary hover:underline">auction rates</Link> here.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Product',
    items: [
      {
        q: 'Where does your cardamom come from?',
        a: "From the Cardamom Hills — the Bodinayakanur, Thevaram and Theni belt in Tamil Nadu and Idukki in Kerala, India's main cardamom-growing region.",
      },
      {
        q: "What's the difference between the grades?",
        a: 'Grades are sorted by pod size. Larger, bolder pods like 8mm and above suit retail packing and gifting. Smaller grades such as 6–7mm are well suited to everyday cooking.',
      },
      {
        q: 'What are splits?',
        a: 'Pods that have opened slightly during drying. The seeds and flavour are intact, and they cost less — which makes them ideal for grinding into masala.',
      },
      {
        q: 'How do I know which grade to buy?',
        a: "Tell us what it's for — hotel kitchen, grinding, retail or gifting — and we'll suggest the right grade.",
      },
      {
        q: 'How should I store cardamom?',
        a: 'In an airtight container, somewhere cool and dry, away from sunlight. Whole pods keep their aroma far longer than ground cardamom.',
      },
      {
        q: 'Where are cardamom auctions held?',
        a: 'Small cardamom is auctioned through Spices Board e-auctions at Bodinayakanur in Tamil Nadu and Puttady in Kerala. We show the latest results with the actual auction date.',
        renderAnswer: () => (
          <>
            Small cardamom is auctioned through Spices Board e-auctions at Bodinayakanur in Tamil Nadu and Puttady in Kerala. We show the{' '}
            <Link to="/cardamom-auction-price" className="text-primary hover:underline">latest results</Link> with the actual auction date.
          </>
        ),
      },
      {
        q: 'Does the auction price tell me the price of a grade?',
        a: "Not on its own. Each auction mixes lots of different sizes, colour and quality, so the average doesn't match any single grade. Tell us the grade and quantity you need and we'll quote.",
      },
    ],
  },
  {
    heading: 'Delivery & packing',
    items: [
      {
        q: 'Where do you deliver?',
        a: 'We courier anywhere in India.',
      },
      {
        q: 'How is it packed?',
        a: 'In cartons or bags, packed and labelled to your requirement.',
      },
      {
        q: 'Do you supply hotels and restaurants?',
        a: 'Yes. We supply kitchens with regular orders and can match a grade to your cooking.',
      },
      {
        q: 'Do you supply for export?',
        a: "We supply export-grade cardamom. Tell us your destination and requirement, and we'll advise on the best way to arrange it.",
      },
    ],
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_GROUPS.flatMap(group =>
    group.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    }))
  ),
};

// Legal name, brand, logo and phone are as they appear in the site footer.
// areaServed lists the sourcing/operating regions the business names
// elsewhere on the site (footer + CLAUDE.md) — no registered office address
// is published anywhere on the site, so none is claimed here.
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Spice One Merchants',
  alternateName: 'Cardamom Spices Centre',
  url: 'https://cardamomspicescentre.com/',
  logo: 'https://cardamomspicescentre.com/logo/logo-full.png',
  telephone: '+91-8838226519',
  areaServed: ['India', 'Kerala', 'Idukki', 'Theni', 'Bodinayakanur', 'Thevaram', 'Madurai'],
};

export default function Home() {
  useDocumentHead({
    title: 'Green Cardamom Wholesale Supplier, Madurai | Cardamom Spices Centre',
    description: 'Wholesale green cardamom from Bodinayakanur, Theni and Idukki — graded 6-7mm to 8mm+, supplied across India. Request a quote.',
    path: '/',
  });
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    try {
      const prodRes = await axios.get(`${API_URL}/api/products`);
      const prods = prodRes.data || [];
      setProducts(prods.slice(0, 4));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }} />

      {/* ── SECTION 1: HERO ─────────────────────── */}
      <section className="bg-[#f5f0e8] pt-44">
        <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_45vw] min-[900px]:h-[540px]">

          {/* Text column — padding replicates the site container's own left inset so this lines up
              with "Available Grades" below, even though this row isn't wrapped in max-w-7xl (the
              image needs to reach the real viewport edge, which a max-w-7xl wrapper would prevent). */}
          <div className="flex flex-col justify-start px-4 md:px-8 min-[900px]:px-0 min-[900px]:pl-[max(2rem,calc((100vw-1280px)/2+2rem))] min-[900px]:pr-10 py-10 min-[900px]:py-0">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--gold)]">
                THE QUEEN OF SPICES
              </span>
              <h1 className="font-serif text-[36px] leading-[1.15] text-[#1a3a1a] max-w-[480px]">
                Green cardamom,<br />matched to your use
              </h1>
              <p className="text-[15px] text-gray-600 max-w-[560px] leading-relaxed">
                Hand-picked in the Cardamom Hills of Idukki and graded to size. Tell us what it's for — hotel kitchens, masala grinding, retail packing, gifting or export supply — and we'll suggest the right grade.
              </p>
              <button
                onClick={() => navigate('/contact')}
                className="bg-[#2d5a27] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1a3a1a] transition-colors text-sm w-fit mt-1"
              >
                Request a price
              </button>
            </div>

            <div className="border-t border-[var(--gold)] my-5 max-w-[560px]" />

            {/* Three-up row rather than a stack — uses the column's actual width instead of
                floating a narrow strip of text in a much wider track. */}
            <div className="grid grid-cols-3 gap-6 max-w-[560px]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)] mb-1">Delivery</p>
                <p className="text-sm text-gray-700">Couriered anywhere in India</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)] mb-1">Quantity</p>
                <p className="text-sm text-gray-700">1kg to bulk. Samples sent based on your need.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)] mb-1">Packing &amp; Labelling</p>
                <p className="text-sm text-gray-700">Cartons or bags, packed and labelled to your requirement</p>
              </div>
            </div>

            <div className="border-t border-[var(--gold)] my-5 max-w-[560px]" />

            <p className="text-sm text-gray-500 max-w-[560px] leading-relaxed">
              Indian cardamom — native to the Western Ghats and traded worldwide as Alleppey Green — is prized for its high oil content, which gives it a stronger, sweeter aroma and a deeper green than cardamom grown elsewhere.
            </p>
          </div>

          {/* Image column — fills the row completely (object-cover) so there's no letterboxed
              dead space; position weighted toward the hand/cardamom, not a literal center-crop. */}
          <div className="h-72 min-[900px]:h-full mt-8 min-[900px]:mt-0 overflow-hidden">
            <img
              src="/hero.jpg"
              alt="Graded green cardamom held in hand at the sorting floor"
              className="w-full h-full object-cover object-[50%_32%] block"
            />
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
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION: AUCTION MARKET RATES ────────── */}
      <MarketRatesPanel linkToFullPage />

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
            onClick={() => navigate('/contact')}
            className="bg-[#2d5a27] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#1a3a1a] transition-colors text-sm"
          >
            Request a price →
          </button>
        </div>
      </section>

      {/* ── SECTION 4: FREQUENTLY ASKED ──────────── */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
        <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-x-16 gap-y-10 items-start">
          {/* Heading and CTA render as one sticky sidebar on desktop. Below 900px this
              wrapper switches to display:contents, dissolving out of the layout so its
              two children become direct grid items again and take their `order` position
              around the accordion instead of staying glued together. */}
          <div className="contents min-[900px]:block min-[900px]:sticky min-[900px]:top-32">
            <div className="order-1 mb-8 min-[900px]:mb-10">
              <h2 className="font-serif text-2xl text-[#1a3a1a] mb-2 text-center min-[900px]:text-left">Frequently Asked</h2>
              <p className="text-gray-500 text-sm text-center min-[900px]:text-left">Everything buyers usually ask before ordering</p>
            </div>
            <div className="order-3">
              <p className="text-gray-600 mb-4 text-center min-[900px]:text-left">Still have a question?</p>
              <div className="flex items-center justify-center min-[900px]:justify-start gap-3">
                <Link
                  to="/contact"
                  className="bg-[#2d5a27] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#1a3a1a] transition-colors text-sm"
                >
                  Request a price
                </Link>
                <a
                  href="https://wa.me/918838226519"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-[#2d5a27] text-[#2d5a27] px-6 py-3 rounded-xl font-bold hover:bg-[#2d5a27]/5 transition-colors text-sm"
                >
                  WhatsApp us
                </a>
              </div>
            </div>
          </div>

          <div className="order-2 min-[900px]:col-span-2 space-y-8">
            {FAQ_GROUPS.map(group => (
              <div key={group.heading}>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#2d5a27] mb-2">{group.heading}</h3>
                <Accordion type="single" collapsible className="bg-white rounded-xl border border-gray-100 shadow-sm px-5">
                  {group.items.map((item, i) => (
                    <AccordionItem key={i} value={`${group.heading}-${i}`} className="border-b border-gray-100 last:border-b-0">
                      <AccordionTrigger className="text-[#1a3a1a] font-semibold hover:no-underline hover:text-[#2d5a27]">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-500 text-sm leading-relaxed">
                        {item.renderAnswer ? item.renderAnswer() : item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
