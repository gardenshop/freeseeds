# Future WhatsApp Number Onboarding

Do not execute this runbook until the user explicitly supplies the new production number.

Staging exception: a Meta-provided clean test WABA/test number may be configured only after visible clean ownership verification. It is synthetic-only, cannot be used for real customers/payments/production events, and does not satisfy production onboarding.

1. Verify the clean Get Free Seeds Meta portfolio by visible account name and ownership.
2. Create or select a clean WABA and verify no Hoja relationship.
3. Add the new number and complete OTP verification.
4. Configure the Get Free Seeds display name and obtain approval.
5. Create a least-privilege system user/token.
6. Set Worker secrets through Cloudflare secret management.
7. Register the public Worker webhook and verify signature settings.
8. Register the Flow public key and publish the repository Flow only to the clean WABA.
9. Configure approved message templates.
10. Record WABA ID and Phone Number ID in `docs/RESOURCE_REGISTRY.md`.
11. Update the one-time bootstrap fields in `rules.md` only after real clean resources are verified.
12. Run the WhatsApp live test and CAPI test with synthetic data.
13. Run complete E2E verification.
14. Consider campaign activation only after all gates pass and explicit paid-ad authorization exists.
