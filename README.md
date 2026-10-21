# Dagi Electronics Shop: launch checklist

Tick each item before you tell customers about the site.

## 1. Files and keys
- [ ] All pages are uploaded: index, admin, platform admin, reports, privacy, 404
- [ ] script.js, admin.js, platform JS and reports.js all have the same `supabaseUrl` and `supabaseKey`
- [ ] The key is the `anon` / publishable key. The `service_role` or secret key is NOT in any file
- [ ] Pictures folder uploaded (laptop.png, phone.png, computer.png)

## 2. Supabase
- [ ] SQL files run in order: phase 2, 3, 4, 6, 7, 8, 9
- [ ] Phase 9 check query shows `rowsecurity = true` for EVERY table
- [ ] Authentication > URL Configuration: Site URL is your live link
- [ ] Authentication: sign-ups are ON (needed for sellers), and email confirmation is ON for launch
- [ ] Custom email service (SMTP) set up, because the built-in email has a very low hourly limit
- [ ] Storage bucket `product-images` shows 2 MB limit and image types only

## 3. Test as each kind of user
- [ ] Customer: search, filter, sort, View details, WhatsApp button opens the right seller
- [ ] Customer: send a test report
- [ ] Seller: create account, open shop, add product with picture
- [ ] Seller shop is invisible to customers while pending
- [ ] Platform admin: approve the shop, product now visible
- [ ] Platform admin: hide the shop, product disappears
- [ ] Seller A cannot see or edit seller B's products

## 4. Content
- [ ] Real WhatsApp, email, address and opening hours in settings
- [ ] Real specs instead of "Add RAM here"
- [ ] Privacy page: replace the example email with a real one
- [ ] Prices checked in ETB

## 5. Backups (do this monthly)
- [ ] Table Editor: export `shops`, `products`, `shop_members` as CSV
- [ ] Keep your SQL files and website files somewhere safe (GitHub already holds the website files)
- [ ] Save your Supabase database password and login recovery email in a safe place
- [ ] Open the site at least once a week. Free Supabase projects can pause when unused, so check
      Supabase's current rules for your plan

## 6. Own domain (optional)
- [ ] Buy a domain from a registrar you trust
- [ ] GitHub repo > Settings > Pages > Custom domain, then follow GitHub's DNS instructions
- [ ] Turn on "Enforce HTTPS"
- [ ] Update Supabase Site URL to the new domain

## 7. After launch
- [ ] Check `reports.html` every few days
- [ ] Check pending shops on your platform admin page daily at first
- [ ] Share the link on Telegram, WhatsApp and Facebook
