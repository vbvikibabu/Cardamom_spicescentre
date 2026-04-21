import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email address'),
  company: z.string().optional(),
  country: z.string().optional(),
  message: z.string().min(20, 'Message must be at least 20 characters').max(1000, 'Message cannot exceed 1000 characters'),
});

const FieldError = ({ msg }) => msg ? (
  <p className="flex items-center gap-1 text-xs text-red-600 mt-1"><XCircle size={12} /> {msg}</p>
) : null;

const inputCls = (err) =>
  `w-full font-sans text-foreground border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 transition-colors ${
    err ? 'border-red-400 focus:ring-red-300 bg-red-50' : 'border-border focus:ring-primary'
  }`;

const Contact = () => {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', company: '', country: '', message: '' },
    mode: 'onBlur',
  });

  const message = watch('message', '');

  const onSubmit = async (data) => {
    try {
      await axios.post(`${API}/contact`, data);
      toast.success('Thank you for your inquiry! We will get back to you soon.');
      reset();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to submit inquiry. Please try again.');
    }
  };

  return (
    <div data-testid="contact-page" className="pt-20">
      {/* Hero */}
      <section className="py-24 bg-muted" data-testid="contact-hero">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto">
            <p className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-6">Get in Touch</p>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tight leading-tight mb-6 text-foreground">
              Let's Start a Conversation
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Whether you're interested in bulk orders, custom quotes, or have questions about our green cardamom products, we're here to help.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-24" data-testid="contact-form-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Contact Information */}
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <h2 className="font-serif text-4xl md:text-5xl tracking-tight mb-8 text-foreground">Contact Information</h2>
              <div className="space-y-8 mb-12">
                {[
                  { icon: MapPin, label: 'Location', lines: ['India', 'Premium Green Cardamom Supplier'] },
                  { icon: Mail, label: 'Email', lines: ['cardamomspicescentre@gmail.com'] },
                  { icon: Phone, label: 'Phone', lines: ['+91-8838226519'] },
                ].map(({ icon: Icon, label, lines }) => (
                  <div key={label} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-sans text-sm tracking-wide uppercase font-bold mb-2 text-foreground">{label}</h3>
                      {lines.map((l, i) => <p key={i} className="text-muted-foreground">{l}</p>)}
                    </div>
                  </div>
                ))}
              </div>
              <img src="https://images.pexels.com/photos/4820660/pexels-photo-4820660.jpeg"
                alt="Cardamom export packaging" className="w-full h-80 object-cover rounded-lg shadow-sm" />
            </motion.div>

            {/* Contact Form */}
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <form onSubmit={handleSubmit(onSubmit)} data-testid="contact-form" className="space-y-8" noValidate>
                <div>
                  <label className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">Full Name *</label>
                  <input {...register('name')} data-testid="contact-form-name" type="text"
                    className={inputCls(errors.name)} placeholder="John Doe" />
                  <FieldError msg={errors.name?.message} />
                </div>

                <div>
                  <label className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">Email Address *</label>
                  <input {...register('email')} data-testid="contact-form-email" type="email"
                    className={inputCls(errors.email)} placeholder="john@company.com" />
                  <FieldError msg={errors.email?.message} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">Company</label>
                    <input {...register('company')} data-testid="contact-form-company" type="text"
                      className={inputCls(errors.company)} placeholder="Company Name" />
                  </div>
                  <div>
                    <label className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">Country</label>
                    <input {...register('country')} data-testid="contact-form-country" type="text"
                      className={inputCls(errors.country)} placeholder="Your Country" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block font-sans text-sm tracking-wide uppercase font-bold text-foreground">Message *</label>
                    <span className={`text-xs ${message.length > 900 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {message.length}/1000
                    </span>
                  </div>
                  <textarea {...register('message')} data-testid="contact-form-message" rows={6}
                    className={`${inputCls(errors.message)} resize-none`}
                    placeholder="Tell us about your requirements..." />
                  <FieldError msg={errors.message?.message} />
                </div>

                <button type="submit" data-testid="contact-form-submit" disabled={isSubmitting}
                  className="btn-primary w-full md:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <><Send size={16} /> Send Message</>}
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
