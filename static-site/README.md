# Cardamom Spices Centre - Static Website

## 🌿 Overview
Production-ready static website for **Cardamom Spices Centre** - a wholesale and export-grade green cardamom supplier operating in Tamil Nadu & Kerala, India.

## ✨ Features
- **Pure Static**: HTML, CSS, JavaScript only (no frameworks, no build process)
- **Responsive Design**: Mobile-first, works on all devices
- **Fast Performance**: Optimized for speed and SEO
- **Modern UI**: Vibrant, professional design with smooth animations
- **Contact Integration**: Ready for Formspree form submission
- **Click-to-Action**: Phone, email, and Instagram links in header & footer

## 📁 File Structure
```
static-site/
├── index.html      # Main HTML file
├── styles.css      # All styles
├── script.js       # JavaScript functionality
└── README.md       # This file
```

## 🚀 Deployment Options

### Option 1: GitHub Pages
1. Create a new GitHub repository
2. Upload `index.html`, `styles.css`, and `script.js`
3. Go to repository Settings → Pages
4. Select "Deploy from a branch" → main/master
5. Your site will be live at `https://username.github.io/repository-name`

### Option 2: Netlify
1. Create account at [netlify.com](https://netlify.com)
2. Drag and drop the `static-site` folder
3. Site goes live instantly with custom domain options

### Option 3: AWS S3
1. Create S3 bucket with public read access
2. Upload `index.html`, `styles.css`, `script.js`
3. Enable static website hosting
4. Access via S3 website endpoint

### Option 4: Vercel
1. Sign up at [vercel.com](https://vercel.com)
2. Import project or drag & drop files
3. Deploy with one click

## 📧 Contact Form Setup (Formspree)

1. Sign up at [formspree.io](https://formspree.io)
2. Create a new form
3. Copy your form endpoint (e.g., `https://formspree.io/f/YOUR_FORM_ID`)
4. In `index.html`, replace:
   ```html
   <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```
5. Test your form - submissions will go to your email

## 🎨 Customization

### Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --primary-color: #2d5a27;    /* Main green */
    --accent-color: #7fb069;     /* Light green */
    --gold: #d4a373;             /* Gold accent */
}
```

### Contact Information
Update in `index.html`:
- Phone: `tel:+918838226519`
- Email: `mailto:cardamomspicescentre@gmail.com`
- Instagram: Update the URL

### Products
Edit product cards in the Products section of `index.html`

## 📱 Contact Links
All contact methods are clickable:
- **Phone**: Opens phone dialer on mobile
- **Email**: Opens default email client
- **Instagram**: Opens in new tab

## 🔍 SEO Optimized
- Semantic HTML5
- Meta descriptions
- Proper heading hierarchy
- Fast loading times
- Mobile-friendly

## 📊 Performance
- No external dependencies (except Font Awesome & Google Fonts)
- Lightweight (~50KB total)
- Fast first paint
- Smooth animations

## 🌐 Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📝 License
All rights reserved - Cardamom Spices Centre 2025

## 💡 Tips
1. Replace Formspree form ID before going live
2. Test on mobile devices
3. Add Google Analytics if needed
4. Consider adding WhatsApp Business link
5. Keep images optimized for web

## 📞 Support
For technical issues or customizations:
- Email: cardamomspicescentre@gmail.com
- Phone: +91-8838226519

---

**Built with ❤️ for Cardamom Spices Centre**