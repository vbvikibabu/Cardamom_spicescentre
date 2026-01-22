import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    country: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await axios.post(`${API}/contact`, formData);
      toast.success('Thank you for your inquiry! We will get back to you soon.');
      setFormData({
        name: '',
        email: '',
        company: '',
        country: '',
        message: ''
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to submit inquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-testid="contact-page" className="pt-20">
      {/* Hero */}
      <section className="py-24 bg-muted" data-testid="contact-hero">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <p className="font-sans text-xs tracking-[0.2em] uppercase font-bold text-accent mb-6">
              Get in Touch
            </p>
            <h1 className="font-serif text-5xl md:text-7xl tracking-tight leading-tight mb-6 text-foreground">
              Let's Start a Conversation
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Whether you're interested in bulk orders, custom quotes, or have questions about our products, 
              we're here to help.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-24" data-testid="contact-form-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-serif text-4xl md:text-5xl tracking-tight mb-8 text-foreground">
                Contact Information
              </h2>
              
              <div className="space-y-8 mb-12">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm tracking-wide uppercase font-bold mb-2 text-foreground">
                      Location
                    </h3>
                    <p className="text-muted-foreground">
                      Kerala, India<br />
                      Heart of the Cardamom Hills
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm tracking-wide uppercase font-bold mb-2 text-foreground">
                      Email
                    </h3>
                    <p className="text-muted-foreground">
                      info@cardamomexport.com<br />
                      sales@cardamomexport.com
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Phone size={20} />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm tracking-wide uppercase font-bold mb-2 text-foreground">
                      Phone
                    </h3>
                    <p className="text-muted-foreground">
                      +91 123 456 7890<br />
                      +91 098 765 4321
                    </p>
                  </div>
                </div>
              </div>

              {/* Image */}
              <img
                src="https://images.pexels.com/photos/4820660/pexels-photo-4820660.jpeg"
                alt="Cardamom export packaging"
                className="w-full h-80 object-cover rounded-lg shadow-sm"
              />
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <form onSubmit={handleSubmit} data-testid="contact-form" className="space-y-8">
                <div>
                  <label htmlFor="name" className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    data-testid="contact-form-name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full font-sans text-foreground"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    data-testid="contact-form-email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full font-sans text-foreground"
                    placeholder="john@company.com"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label htmlFor="company" className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">
                      Company
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      data-testid="contact-form-company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full font-sans text-foreground"
                      placeholder="Company Name"
                    />
                  </div>

                  <div>
                    <label htmlFor="country" className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">
                      Country
                    </label>
                    <input
                      type="text"
                      id="country"
                      name="country"
                      data-testid="contact-form-country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full font-sans text-foreground"
                      placeholder="Your Country"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block font-sans text-sm tracking-wide uppercase font-bold mb-3 text-foreground">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    data-testid="contact-form-message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full font-sans text-foreground resize-none"
                    placeholder="Tell us about your requirements..."
                  />
                </div>

                <button
                  type="submit"
                  data-testid="contact-form-submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full md:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-sans text-sm tracking-wide uppercase font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                  <Send size={16} />
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
