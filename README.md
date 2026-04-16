# Custom Address Card with OTP System

A modern, responsive address card form with OTP verification that sends data to your email via FormSubmit.co.

## Features

- **Modern Design**: Beautiful gradient design with Bootstrap 5
- **OTP Verification**: Secure 6-digit OTP system
- **Form Validation**: Client-side validation for all fields
- **Email Integration**: Uses FormSubmit.co to send data directly to your email
- **Card Preview**: Shows a preview of the generated address card
- **Responsive**: Works perfectly on all devices
- **No API Keys Required**: Uses FormSubmit.co - no setup needed

## Files

- `address-card.html` - Main form with all functionality
- `email-config.html` - Setup instructions (if you want to use EmailJS instead)
- `test.html` - Simple test page

## How to Use

1. Open `address-card.html` in your web browser
2. Fill in all the required fields:
   - Full Name
   - Email Address
   - Phone Number
   - Street Address
   - City
   - Postal Code
   - Country
   - Purpose/Type
3. Click "Generate OTP & Send Card"
4. An OTP will be shown (for demo) and the OTP verification section will appear
5. Enter the 6-digit OTP
6. Click "Verify OTP"
7. Your address card data will be sent to `anandjhare4@gmail.com`

## Email Delivery

The form submits directly to FormSubmit.co which will:
- Send all form data to `anandjhare4@gmail.com`
- Include the OTP code used
- Include a formatted HTML address card
- Send a confirmation to the user's email

## Technical Details

- **Frontend**: HTML5, Bootstrap 5, Font Awesome
- **Form Handling**: FormSubmit.co
- **OTP System**: Client-side generation (6 digits)
- **Validation**: Email regex, required field checks
- **Styling**: Modern gradient design with hover effects

## Customization

To change the recipient email, edit this line in `address-card.html`:
```html
<form action="https://formsubmit.co/YOUR_EMAIL@gmail.com" method="POST">
```

## Demo Mode

Currently runs in demo mode where:
- OTP is shown in an alert box
- Form data is logged to console
- Actual email sending happens via FormSubmit.co

## Browser Compatibility

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## CRM Cloud Sync (Access From Anywhere)

To make CRM data available across devices, enable Supabase sync.

1. Create a Supabase table:
```sql
create table if not exists crm_records (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
```
2. Set your values in `js/crm-cloud-config.js` (or `crm-cloud-config.json` for deploy-wide defaults):
   - `projectUrl`
   - `anonKey` (use Supabase publishable key `sb_publishable_...` or anon JWT key)
   - optional: `table`, `recordId`
3. Open `crm.html` and click `Cloud Setup` to verify/update values quickly.
4. Use the checkout flow normally; orders/cards/otp will sync to cloud and appear in CRM on other devices.

If cloud setup reports table missing, run `supabase-crm-setup.sql` in Supabase SQL Editor.
