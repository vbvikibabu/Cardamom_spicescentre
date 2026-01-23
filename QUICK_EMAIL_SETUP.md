# QUICK EMAIL SETUP - Get Emails in 5 Minutes! 📧

## Your contact form is working, but emails need Gmail App Password to be sent.

### Step 1: Get Gmail App Password (2 minutes)

1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** (left menu)
3. Enable **2-Step Verification** (if not already enabled)
4. Go back to **Security**
5. Click on **App passwords** (under "How you sign in to Google")
6. Select:
   - App: **Mail**
   - Device: **Other (Custom name)**
   - Type: **Cardamom Website**
7. Click **Generate**
8. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 2: Add Credentials to Backend (1 minute)

Add these two lines to `/app/backend/.env`:

```bash
SMTP_USERNAME=cardamomspicescentre@gmail.com
SMTP_PASSWORD=your_16_character_app_password_here
```

**Example:**
```bash
SMTP_USERNAME=cardamomspicescentre@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
```

**Important:** 
- No spaces in the password
- No quotes around the values
- Use the email: cardamomspicescentre@gmail.com

### Step 3: Restart Backend (10 seconds)

```bash
sudo supervisorctl restart backend
```

### Step 4: Test It! (1 minute)

1. Go to your website contact form
2. Fill it out and submit
3. Check cardamomspicescentre@gmail.com inbox
4. You should receive a beautifully formatted email!

---

## Need Help?

### Check if it's working:
```bash
tail -f /var/log/supervisor/backend.out.log
```

Look for:
- ✓ EMAIL SENT SUCCESSFULLY ← This means it's working!
- ✗ Email sending failed ← Check your credentials

### Common Issues:

**"Authentication failed"**
- Make sure 2-Step Verification is enabled
- Use App Password, not your regular Gmail password
- Check for typos in .env file

**"Connection timeout"**
- Check internet connection
- Gmail SMTP might be blocked (rare)

**Still not working?**
1. Delete and recreate the App Password
2. Make sure no spaces in the password
3. Restart backend after editing .env

---

## Alternative: Check Database Instead

Even without email setup, all inquiries are saved to MongoDB:

```bash
# View all contact inquiries
mongosh $MONGO_URL --eval "use cardamom_spices; db.contact_inquiries.find().pretty()"
```

You can check the database regularly for new inquiries.

---

## What You'll Receive:

When someone submits the form, you'll get an email with:
- ✅ Customer name
- ✅ Email address (clickable to reply)
- ✅ Company name (if provided)
- ✅ Country (if provided)
- ✅ Full message
- ✅ Timestamp
- ✅ Quick reply button

---

**That's it! Your email notifications will work perfectly.** 🎉

Need more help? Check the backend logs or contact support.
