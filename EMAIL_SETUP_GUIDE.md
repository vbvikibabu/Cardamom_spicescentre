# Email Configuration Guide for Contact Form

## Current Status
✅ Backend code is ready to send emails
✅ Email template is formatted and professional
✅ Contact form submissions are saved to database
⚠️ Email sending is currently SIMULATED (needs SMTP credentials)

## To Enable Real Email Sending

### Option 1: Using Gmail SMTP (Recommended for Testing)

1. **Create App Password in Gmail:**
   - Go to your Google Account: https://myaccount.google.com/
   - Security → 2-Step Verification (enable if not already)
   - Security → App passwords
   - Select "Mail" and "Other (Custom name)"
   - Name it "Cardamom Website"
   - Copy the 16-character password

2. **Add to Backend .env file:**
   ```bash
   SMTP_USERNAME=cardamomspicescentre@gmail.com
   SMTP_PASSWORD=your_16_char_app_password_here
   ```

3. **Uncomment email sending code in server.py:**
   Find this section (around line 120):
   ```python
   # In production, uncomment and configure:
   # await aiosmtplib.send(
   #     message,
   #     hostname=smtp_server,
   #     port=smtp_port,
   #     start_tls=True,
   #     username=os.environ.get('SMTP_USERNAME'),
   #     password=os.environ.get('SMTP_PASSWORD')
   # )
   ```
   
   Remove the `#` to uncomment these lines.

4. **Restart backend:**
   ```bash
   sudo supervisorctl restart backend
   ```

### Option 2: Using SendGrid (Recommended for Production)

1. **Sign up at SendGrid:**
   - Go to https://sendgrid.com
   - Free plan: 100 emails/day

2. **Get API Key:**
   - Settings → API Keys → Create API Key
   - Give it full access
   - Copy the API key

3. **Install SendGrid package:**
   ```bash
   cd /app/backend
   pip install sendgrid
   pip freeze > requirements.txt
   ```

4. **Add to .env:**
   ```bash
   SENDGRID_API_KEY=your_sendgrid_api_key
   SENDER_EMAIL=noreply@yourdomain.com
   ```

5. **Update server.py** (replace the aiosmtplib section with SendGrid code)

### Option 3: Using Resend (Modern, Developer-Friendly)

1. **Sign up at Resend:**
   - Go to https://resend.com
   - Free plan: 100 emails/day
   - Very easy to set up

2. **Get API Key:**
   - Dashboard → API Keys → Create
   - Copy the key

3. **Install package:**
   ```bash
   cd /app/backend
   pip install resend
   pip freeze > requirements.txt
   ```

4. **Add to .env:**
   ```bash
   RESEND_API_KEY=re_your_api_key
   ```

## What Happens Currently (Without SMTP Setup)

When someone submits the contact form:
✅ Data is saved to MongoDB database
✅ Response is sent back to user (success message shown)
✅ Email notification is LOGGED (you can see it in backend logs)
❌ Email is NOT actually sent (needs SMTP credentials)

## Check Backend Logs

To see form submissions:
```bash
tail -f /var/log/supervisor/backend.out.log
```

You'll see messages like:
```
INFO: Email notification prepared for inquiry from John Doe (john@example.com)
INFO: Email would be sent to: cardamomspicescentre@gmail.com
INFO: New contact inquiry received from John Doe (john@example.com)
```

## Testing Email Functionality

1. **Before SMTP Setup:**
   - Submit the contact form
   - Check backend logs: `tail -n 50 /var/log/supervisor/backend.out.log`
   - Look for: "Email notification prepared"

2. **After SMTP Setup:**
   - Submit the contact form
   - Check cardamomspicescentre@gmail.com inbox
   - You should receive a formatted email with inquiry details

## Email Template Preview

The email will include:
- **Subject:** "New Enquiry from [Customer Name]"
- **From:** noreply@cardamomspicescentre.com
- **To:** cardamomspicescentre@gmail.com
- **Content:**
  - Customer name
  - Email address
  - Company (if provided)
  - Country (if provided)
  - Message
  - Timestamp

## Troubleshooting

### Emails not sending after setup?

1. **Check .env file:**
   ```bash
   cat /app/backend/.env | grep SMTP
   ```

2. **Verify code is uncommented in server.py**

3. **Check backend logs for errors:**
   ```bash
   tail -f /var/log/supervisor/backend.err.log
   ```

4. **Test SMTP connection:**
   ```python
   import aiosmtplib
   # Test your SMTP settings
   ```

### Gmail App Password not working?

- Ensure 2-Step Verification is enabled
- App password is 16 characters (no spaces)
- Username is full email: cardamomspicescentre@gmail.com

### SendGrid/Resend not working?

- Verify API key is correct
- Check sender email is verified in their dashboard
- Review API limits (free tier)

## Production Recommendations

For a production website, use:
1. **SendGrid** or **Resend** (more reliable than Gmail)
2. Add email rate limiting (prevent spam)
3. Add CAPTCHA to contact form
4. Set up email templates in the service dashboard
5. Monitor email delivery rates

## Quick Setup (5 minutes)

**Fastest way to get emails working:**

1. Get Gmail App Password (2 min)
2. Add to `/app/backend/.env`:
   ```
   SMTP_USERNAME=cardamomspicescentre@gmail.com
   SMTP_PASSWORD=your_app_password
   ```
3. Edit `/app/backend/server.py` - uncomment the `aiosmtplib.send()` section (1 min)
4. Restart: `sudo supervisorctl restart backend` (10 sec)
5. Test form submission (1 min)

Done! Emails will now be sent to cardamomspicescentre@gmail.com

---

**Note:** The contact form is fully functional. Submissions are saved to the database. You just need to configure SMTP to receive email notifications.
