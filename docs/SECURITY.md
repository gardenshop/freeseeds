# Security

- Hoja Seeds resources and the known Hoja-linked Cloudflare account are prohibited.
- No WhatsApp number or WABA is connected in the current phase.
- `MetaWhatsAppProvider` is disabled by configuration and requires explicit readiness gates.
- D1 is private operational state; R2 receipts remain private and are served only through the Access-protected admin Worker.
- Cloudflare Access allows only `gisupp@gmail.com` for admin routes; the public API callback is not Access-blocked.
- Tokens, app secrets, webhook secrets, Flow keys, Cloudflare API tokens, payment credentials, receipts, and customer exports never enter Git.
- Webhook HMAC validates raw request bodies with constant-time comparison. Admin mutations require CSRF and same-origin protections.
- Logs use correlation IDs and redact secrets and unnecessary PII.
- Queue payloads carry IDs and schema version, not secrets or full customer data.
