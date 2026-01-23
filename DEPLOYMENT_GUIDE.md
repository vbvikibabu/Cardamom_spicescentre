# 🚀 Cardamom Spices Centre - Deployment Guide

## 📦 Package Contents

Your static website package includes:
- `index.html` - Main website file (all sections in one page)
- `styles.css` - All styling and animations
- `script.js` - Interactive features and smooth scrolling
- `README.md` - Documentation

## ✨ Website Features

### ✅ What's Included:
- **Hero Section** with certification badge and CTAs
- **3 Product Grades** (6-7mm, 7-8mm, 8mm+)
- **Common Specifications** section
- **About Section** with compliance information
- **Contact Form** (ready for Formspree)
- **Sticky Header** with click-to-call/email/Instagram
- **Responsive Footer** with all contact details
- **Mobile-Friendly** navigation and design
- **Smooth Animations** and hover effects
- **No prices** (as requested)
- **GST compliance** statement

### 📞 Contact Actions (All Clickable):
- Phone: Opens dialer on mobile
- Email: Opens email client
- Instagram: Opens in new tab

## 🌐 Deployment Options

### Option 1: GitHub Pages (FREE) ⭐ Recommended

1. **Create GitHub Repository**
   ```bash
   # On GitHub.com:
   - Click "New Repository"
   - Name it: cardamom-spices-centre
   - Make it Public
   - Don't add README (we have one)
   ```

2. **Upload Files**
   - Go to your repository
   - Click "Add file" → "Upload files"
   - Drag and drop: `index.html`, `styles.css`, `script.js`, `README.md`
   - Commit changes

3. **Enable GitHub Pages**
   - Go to Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: main/master
   - Click Save

4. **Access Your Site**
   - URL: `https://yourusername.github.io/cardamom-spices-centre`
   - Takes 2-3 minutes to go live

### Option 2: Netlify (FREE with Custom Domain)

1. **Sign Up**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with GitHub/Email

2. **Deploy**
   - Drag & drop the `static-site` folder
   - OR connect your GitHub repository
   - Site goes live instantly

3. **Custom Domain (Optional)**
   - Buy domain (e.g., cardamomspicescentre.com)
   - Add in Netlify: Domain settings → Add custom domain
   - Update DNS records as instructed

4. **Your Site**
   - Gets random URL: `random-name-123.netlify.app`
   - Can change to: `cardamom-spices-centre.netlify.app`

### Option 3: Vercel (FREE)

1. **Sign Up**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub/Email

2. **Deploy**
   - Click "New Project"
   - Import from GitHub OR
   - Drag & drop files
   - Deploy in seconds

3. **Your Site**
   - Gets URL: `cardamom-spices-centre.vercel.app`
   - Custom domain available

### Option 4: AWS S3 (Budget: ~$1-2/month)

1. **Create S3 Bucket**
   ```bash
   - Go to AWS Console → S3
   - Create bucket: cardamom-spices-centre-website
   - Region: Closest to your customers
   - Uncheck "Block all public access"
   ```

2. **Upload Files**
   - Upload all files to bucket root
   - Make files publicly readable

3. **Enable Static Hosting**
   - Bucket Properties → Static website hosting
   - Enable it
   - Index document: index.html
   - Save

4. **Access Your Site**
   - Endpoint URL provided
   - Example: `cardamom-spices-centre-website.s3-website-us-east-1.amazonaws.com`

### Option 5: Simple Web Host (e.g., Hostinger, Bluehost)

1. **Get Hosting Account**
   - Any basic shared hosting plan works
   - Cost: ~$3-5/month

2. **Upload via FTP or cPanel**
   - Use FileZilla or cPanel File Manager
   - Upload to `public_html` folder

3. **Access**
   - Your domain directly

## 📧 Setting Up Contact Form (Formspree)

**Important: Form won't work until you set this up!**

1. **Create Formspree Account**
   - Go to [formspree.io](https://formspree.io)
   - Sign up (Free plan: 50 submissions/month)

2. **Create New Form**
   - Click "+ New Form"
   - Name it: "Cardamom Spices Centre Enquiries"
   - Copy the form endpoint

3. **Update index.html**
   - Find this line (line ~449):
     ```html
     <form id=\"enquiryForm\" class=\"contact-form\" action=\"https://formspree.io/f/YOUR_FORM_ID\" method=\"POST\">
     ```
   - Replace `YOUR_FORM_ID` with your actual form ID
   - Example:
     ```html
     <form id=\"enquiryForm\" class=\"contact-form\" action=\"https://formspree.io/f/xwpejkrd\" method=\"POST\">
     ```

4. **Re-upload index.html**
   - Upload the updated file to your hosting

5. **Test It**
   - Fill out the contact form
   - Check your email for submission

## 🎨 Customization Guide

### Change Colors

Edit `styles.css` (lines 2-12):
```css
:root {
    --primary-color: #2d5a27;    /* Main green - change this */
    --accent-color: #7fb069;     /* Light green - change this */
    --gold: #d4a373;             /* Gold accent - change this */
}
```

### Update Contact Information

Edit `index.html`:
1. **Phone Number** (appears in 6 places):
   - Search for: `+91-8838226519`
   - Replace with your number
   - Also update: `tel:+918838226519`

2. **Email** (appears in 6 places):
   - Search for: `cardamomspicescentre@gmail.com`
   - Replace with your email
   - Also update: `mailto:cardamomspicescentre@gmail.com`

3. **Instagram** (appears in 4 places):
   - Search for the Instagram URL
   - Replace with your Instagram profile URL

### Change Product Images

In `index.html`, find the product sections and update `src`:
```html
<img src="YOUR_IMAGE_URL_HERE" alt="Green Cardamom">
```

Recommended: Use image hosting like:
- Imgur.com (free)
- Cloudinary (free tier)
- Upload to your hosting's images folder

### Modify Product Content

Edit the product cards in `index.html`:
- Product titles
- Descriptions
- Features lists
- Specifications

## 📱 Testing Checklist

Before going live:

- [ ] Test on desktop browser (Chrome, Firefox, Safari)
- [ ] Test on mobile (iOS Safari, Chrome Mobile)
- [ ] Click all contact buttons (phone, email, Instagram)
- [ ] Submit test form (after Formspree setup)
- [ ] Check all internal links (#home, #products, #about, #contact)
- [ ] Verify mobile menu works
- [ ] Check all images load
- [ ] Test scroll-to-top button
- [ ] Verify header becomes sticky on scroll

## 🔧 Troubleshooting

### Form Not Working
- Check Formspree form ID is correct
- Verify action URL in form tag
- Check browser console for errors

### Images Not Loading
- Ensure image URLs are valid
- Check image URLs start with `https://`
- Try opening image URL directly in browser

### Mobile Menu Not Opening
- Clear browser cache
- Check JavaScript console for errors
- Ensure `script.js` is loaded

### Contact Links Not Working
- Phone: Ensure format is `tel:+918838226519` (no spaces)
- Email: Ensure format is `mailto:email@example.com`
- Instagram: Ensure URL is complete with `https://`

## 🚀 Performance Tips

1. **Optimize Images**
   - Compress before uploading
   - Use WebP format for better compression
   - Recommended tools: TinyPNG, Squoosh.app

2. **Enable Caching** (if using custom hosting)
   - Add `.htaccess` file:
     ```apache
     <IfModule mod_expires.c>
       ExpiresActive On
       ExpiresByType text/css \"access plus 1 year\"
       ExpiresByType text/javascript \"access plus 1 year\"
       ExpiresByType image/jpeg \"access plus 1 year\"
       ExpiresByType image/png \"access plus 1 year\"
     </IfModule>
     ```

3. **Add Google Analytics** (Optional)
   - Sign up at [analytics.google.com](https://analytics.google.com)
   - Get tracking code
   - Add before `</head>` in index.html

## 📊 SEO Optimization

Already included:
- ✅ Semantic HTML5
- ✅ Meta descriptions
- ✅ Proper heading hierarchy (H1, H2, H3)
- ✅ Alt text for images
- ✅ Mobile-friendly
- ✅ Fast loading

To improve:
1. **Add Google Search Console**
   - Verify ownership
   - Submit sitemap

2. **Create sitemap.xml**
   ```xml
   <?xml version=\"1.0\" encoding=\"UTF-8\"?>
   <urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">
     <url>
       <loc>https://yourdomain.com/</loc>
       <priority>1.0</priority>
     </url>
   </urlset>
   ```

## 🎯 Next Steps After Launch

1. **Test Everything** - Click every button, link, and form
2. **Monitor Form Submissions** - Check Formspree dashboard
3. **Track Performance** - Use Google PageSpeed Insights
4. **Backup Files** - Keep a copy of all files
5. **Update Content** - Keep products and contact info current

## 💡 Enhancement Ideas

Consider adding later:
- WhatsApp Business button
- Google Maps location
- Customer testimonials section
- Photo gallery
- Blog/News section
- Multiple language support
- Live chat widget

## 📞 Need Help?

If you need customization or support:
- Email: cardamomspicescentre@gmail.com
- Phone: +91-8838226519

## ✅ Final Checklist

Before launching:
- [ ] Formspree form ID updated
- [ ] All contact information verified
- [ ] Tested on mobile and desktop
- [ ] All links working
- [ ] Images loading correctly
- [ ] Content proofread
- [ ] Backup files saved

---

**🎉 Your website is ready to launch!**

Choose your preferred deployment method above and go live in minutes.

**Good luck with your cardamom export business! 🌿**
