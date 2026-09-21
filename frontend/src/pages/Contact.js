import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, MessageCircle, Send, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const USE_OPTIONS = [
  'Hotel or restaurant kitchen',
  'Masala grinding',
  'Retail packing',
  'Gifting',
  'Export supply',
  'Home use',
  'Not sure — advise me',
];

const GRADE_OPTIONS = [
  '6–7mm',
  '7–8mm',
  '8mm & above',
  'Splits',
  'Not sure — advise me',
];

const CONTACT_ROWS = [
  { icon: Phone, label: 'Phone', value: '+91-8838226519', href: 'tel:+918838226519' },
  { icon: MessageCircle, label: 'WhatsApp', value: '+91-8838226519', href: 'https://wa.me/918838226519' },
  { icon: Mail, label: 'Email', value: 'cardamomspicescentre@gmail.com', href: 'mailto:cardamomspicescentre@gmail.com' },
];

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  email: z.union([z.literal(''), z.string().email('Enter a valid email address')]).optional(),
  company: z.string().optional(),
  use: z.enum(USE_OPTIONS),
  grade: z.enum(GRADE_OPTIONS),
  quantity_kg: z.coerce.number({ invalid_type_error: 'Enter a quantity' }).positive('Quantity must be greater than zero'),
  delivery_location: z.string().min(2, 'Delivery city or pincode is required'),
  message: z.string().optional(),
  website: z.string().optional(),
});

const FieldError = ({ msg }) => msg ? (
  <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={12} /> {msg}</p>
) : null;

const fieldCls = (err) =>
  `w-full font-sans text-[#1a3a1a] bg-white border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 transition-colors ${
    err ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-gray-200 focus:ring-[#2d5a27]'
  }`;

const Contact = () => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', phone: '', email: '', company: '',
      use: 'Not sure — advise me', grade: 'Not sure — advise me',
      quantity_kg: '', delivery_location: '', message: '', website: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data) => {
    try {
      // Pydantic's EmailStr rejects '' outright — omit the key entirely when left blank
      // so the backend's Optional[EmailStr] = None default applies instead.
      await axios.post(`${API}/contact`, { ...data, email: data.email || undefined });
      toast.success("Thanks — we've got your enquiry and will get back to you shortly.");
      reset();
    } catch (error) {
      if (error.response?.status === 429) {
        toast.error('Too many enquiries from this network. Please try again later.');
      } else {
        toast.error('Failed to submit enquiry. Please try again or reach us on WhatsApp.');
      }
    }
  };

  return (
    <div data-testid="contact-page" className="pt-32 bg-[#f5f0e8] min-h-screen">
      {/* Heading */}
      <section className="py-10 md:py-14" data-testid="contact-hero">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight text-[#1a3a1a] mb-3">
            Request a price
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl">
            Tell us what it's for and we'll suggest the right grade and quote you.
          </p>
        </div>
      </section>

      <section className="pb-24" data-testid="contact-form-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-16 items-stretch">
            {/* Left: contact info + image */}
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}
              className="flex flex-col">
              <div className="space-y-6 mb-8">
                {CONTACT_ROWS.map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2d5a27]/10 flex items-center justify-center text-[#2d5a27]">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-sans text-xs tracking-wide uppercase font-bold mb-1 text-gray-500">{label}</h3>
                      <a
                        href={href}
                        target={href.startsWith('http') ? '_blank' : undefined}
                        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="text-[#1a3a1a] hover:text-[#2d5a27] transition-colors"
                      >
                        {value}
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-8 text-[#2d5a27]">
                <MapPin size={18} className="flex-shrink-0" />
                <p className="text-sm font-semibold">Sourcing: Bodinayakanur &amp; Idukki</p>
              </div>

              {/* Fills whatever height remains up to the form's height (never the image's own
                  natural height) — that's what keeps the bottom of the photo level with the
                  bottom of the form instead of trailing off into empty space. */}
              <div className="h-[360px] min-[900px]:h-auto min-[900px]:flex-1 min-[900px]:min-h-0 rounded-2xl shadow-sm overflow-hidden">
                <img
                  src="/contact.jpg"
                  alt="Green cardamom sacks at our sourcing floor"
                  className="w-full h-full object-cover object-bottom block"
                />
              </div>
            </motion.div>

            {/* Enquiry form */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <form onSubmit={handleSubmit(onSubmit)} data-testid="contact-form" className="space-y-6" noValidate>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">Name *</label>
                    <input {...register('name')} data-testid="contact-form-name" type="text"
                      className={fieldCls(errors.name)} placeholder="Your name" />
                    <FieldError msg={errors.name?.message} />
                  </div>
                  <div>
                    <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">Phone *</label>
                    <input {...register('phone')} data-testid="contact-form-phone" type="tel"
                      className={fieldCls(errors.phone)} placeholder="+91-XXXXXXXXXX" />
                    <FieldError msg={errors.phone?.message} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">Email</label>
                    <input {...register('email')} data-testid="contact-form-email" type="email"
                      className={fieldCls(errors.email)} placeholder="you@company.com" />
                    <FieldError msg={errors.email?.message} />
                  </div>
                  <div>
                    <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">Company</label>
                    <input {...register('company')} data-testid="contact-form-company" type="text"
                      className={fieldCls(errors.company)} placeholder="Company name" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">What is it for?</label>
                    <select {...register('use')} data-testid="contact-form-use" className={fieldCls(errors.use)}>
                      {USE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">Grade</label>
                    <select {...register('grade')} data-testid="contact-form-grade" className={fieldCls(errors.grade)}>
                      {GRADE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">Quantity (kg) *</label>
                    <input {...register('quantity_kg')} data-testid="contact-form-quantity" type="number" min="0" step="any"
                      className={fieldCls(errors.quantity_kg)} placeholder="e.g. 500" />
                    <FieldError msg={errors.quantity_kg?.message} />
                  </div>
                  <div>
                    <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">Delivery city or pincode *</label>
                    <input {...register('delivery_location')} data-testid="contact-form-delivery" type="text"
                      className={fieldCls(errors.delivery_location)} placeholder="e.g. Chennai or 600001" />
                    <FieldError msg={errors.delivery_location?.message} />
                  </div>
                </div>

                <div>
                  <label className="block font-sans text-sm font-semibold mb-2 text-[#1a3a1a]">Message</label>
                  <textarea {...register('message')} data-testid="contact-form-message" rows={4}
                    className={`${fieldCls(errors.message)} resize-none`}
                    placeholder="Anything else we should know?" />
                </div>

                {/* Honeypot — invisible to real visitors, left for bots that autofill every field */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
                  <label htmlFor="contact-website">Website</label>
                  <input {...register('website')} type="text" id="contact-website" tabIndex={-1} autoComplete="off" />
                </div>

                <button type="submit" data-testid="contact-form-submit" disabled={isSubmitting}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-[#2d5a27] text-white px-8 py-4 rounded-xl font-sans text-sm tracking-wide font-semibold hover:bg-[#1a3a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <><Send size={16} /> Request a price</>}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
