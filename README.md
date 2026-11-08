# Coaching Mentoring Session Transcript Generator
# ایجادکننده متن جلسه منتورینگ کوچینگ

A static, server-less web page that turns a recorded coaching session into a time-stamped,
speaker-labelled transcript in the mentor's Word template. Audio goes directly from the user's
browser to ElevenLabs (Speech to Text) with the user's own API key; the Word file is built in the
browser. No server, no analytics, no third-party scripts; a Content Security Policy restricts all
network connections to `api.elevenlabs.io`.

صفحه‌ای بدون سرور که فایل صوتی جلسه‌ی کوچینگ را به متن زمان‌دار با تفکیک کوچ و مراجع، در قالب ورد منتور، تبدیل می‌کند.
صدا مستقیم از مرورگر کاربر و با کلید خود او به ElevenLabs می‌رود و فایل ورد در خود مرورگر ساخته می‌شود.

- `index.html` — Persian page / صفحه‌ی فارسی
- `en/index.html` — English page / صفحه‌ی انگلیسی
- `assets/` — app code, Word template, JSZip (MIT/GPLv3 dual), Vazirmatn font (SIL OFL)

Created by amirprvf — amirprvf@gmail.com
