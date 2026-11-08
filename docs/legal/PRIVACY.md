# Zamin — Privacy Policy (DRAFT)

> **DRAFT for owner review — not legal advice.** Fill every `[PLACEHOLDER]`, then have it reviewed
> (ideally by a lawyer familiar with India's Digital Personal Data Protection Act, 2023) before
> publishing. Every data practice below was written from the app's actual code as of 2026-11-08;
> if the app changes, update this document in the same change.

**Effective date:** [EFFECTIVE DATE]
**Who we are:** Zamin is operated by [BUSINESS / OWNER NAME], [CITY, STATE], India ("we", "us").
**Contact / grievance officer:** [NAME], [CONTACT EMAIL]

## 1. What Zamin is
Zamin is a zero-brokerage property marketplace. Owners post listings; buyers and renters browse,
save listings, chat with owners, make offers and schedule visits.

## 2. Information we collect

| What | When | Why |
|---|---|---|
| **Account:** username, password (stored by our auth provider, never by us in readable form), optional first/last name, optional email and/or phone number | Sign-up / Settings | To create and secure your account; a verified email/phone shows a "Verified owner" badge and enables password reset |
| **Profile photo** (optional) | Settings | Shown on your profile, your listings and your messages. We re-encode uploaded photos and strip embedded metadata (e.g. GPS) |
| **Listings:** title, description, type, price, area, rooms, amenities, address/locality, map location, contact (phone/WhatsApp) number, photos | When you post or edit | To publish your listing to other users |
| **Listing location** | When you set a pin (typed address, current location, or map) | To show the property on the map. You choose **Exact**, **Approximate (~400 m)** or **Hidden** for other users |
| **On-site photo location** (optional) | When you use "On-site photo" | Location + time at capture, to show a listing's photos were taken at the property |
| **Messages, offers, visit requests** | When you use chat / offers / visits | To deliver them to the other person |
| **Saved listings and saved searches** | When you save them | To show them to you and alert you to new matches |
| **Reviews and reports** | When you submit them | Trust & safety |
| **Blocks** | When you block someone | To stop messages between you |
| **Push notification token** | If you allow notifications | To notify you of new messages and matches |
| **Current location** (only while using a feature) | "Near me", "Use my location" | To find nearby listings / set a pin. Not stored unless you save it on a listing |
| **Crash and error reports** | Automatically | To fix bugs. Configured **not** to send personal data by default |

We do **not** sell your personal data and do not use it for third-party advertising.

## 3. What other users can see
- Your listings: everything you put in them, your display name/username, profile photo, and
  verified badge. The map location follows your Exact / Approximate / Hidden choice.
- Messages, offers and visit requests are visible only to you and the other person.
- Reviews you write are shown on the owner's profile.

## 4. Service providers we use
We share data only as needed to run the app:
- **Clerk** — account sign-up, sign-in, passwords, profile photo.
- **Our cloud host** ([HOSTING PROVIDER, e.g. Railway]) — servers, database and photo storage.
- **Expo (push service)** — delivering push notifications (token + message preview).
- **Google Maps** (Android) / **Apple Maps** (iOS) — displaying maps; your device's map SDK talks to them.
- **Sentry** — crash and error reports.
- **Google / Facebook / Apple** — only if you choose to sign in with them.
These providers may process data outside India under their own safeguards.

## 5. How long we keep data
- Account data: until you delete your account.
- Listings and messages: until you delete them or your account; [RETENTION PERIOD] afterwards in backups.
- Unfinished photo uploads: deleted automatically within about 1 hour.
- Reports and safety records: [RETENTION PERIOD], to prevent abuse.

## 6. Your choices and rights
You can view and edit your profile and listings in the app, change location visibility, turn off
notifications, block users, and delete listings. You may request access to, correction of, or
deletion of your personal data, or withdraw consent, by writing to [CONTACT EMAIL]. We respond within
[N] days. You can delete your account at any time in the app: **Settings → Delete account**. This
permanently deletes your account, listings and their photos, messages, saved listings and searches,
visit requests, notifications, reviews and the reports you filed. Reports other users made about
your account may be kept for [RETENTION PERIOD] for safety and abuse prevention.

## 7. Security
Passwords are handled by our auth provider; connections use HTTPS in production; photos are
re-encoded on our servers; access to your data is restricted to your account. No system is
perfectly secure — please use a strong, unique password.

## 8. Children
Zamin is not intended for anyone under 18. We do not knowingly collect children's data.

## 9. Changes
We'll update this page and the effective date, and notify you in the app for significant changes.

## 10. Contact
[BUSINESS / OWNER NAME] · [ADDRESS] · [CONTACT EMAIL]

---
**Note for the owner:** in-app deletion exists (Settings → Delete account). Google Play also requires a
**public web link** — the API serves one at `<API base>/account-deletion` (set `SUPPORT_EMAIL`); enter it
in Play Console → Data safety.
