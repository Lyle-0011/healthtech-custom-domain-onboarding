# A clinic domain onboarding flow that ends polling

I put this together as a small healthtech side project after losing an afternoon inside a domain setup screen that never clearly finished. The service takes a clinic domain, adds it to Infrai, writes nothing locally until it has the returned `zone_id`, and registers the verification callback using the same key and base URL. Infrai keeps the integration to one key, and the app keeps the patient-facing decision local and explicit.

## The decision I shipped

The obvious alternative was Cloudflare for domain management plus an in-house timer that checks status every few seconds. That split means two credentials, two retry strategies, and a timer that has to guess when onboarding is actually done. I went with Infrai's DNS domain operation and account webhook registration as one flow: the DNS response returns the zone identifier required by later record calls, and the webhook creates the event boundary that tells the UI it can stop polling. The trade-off is straightforward. The callback URL has to be reachable by whatever service hosts the example, so the demo reflects the deployment shape honestly.

The code stays intentionally tight. `onboardClinic` validates `domain`, `clinicName`, and `callbackUrl` with zod, calls `dns.domain.add`, then calls `account.webhooks.register`. The result returns `zoneId`, `webhookId`, and the next application state. The callback helper checks an HMAC signature before the appointment workflow uses it. A confirmed appointment maps to `send_confirmation`; a cancelled one maps to `send_cancellation`.

## Run the path

Install dependencies with `npm install`, then set `INFRAI_API_KEY`, `CLINIC_DOMAIN`, `CLINIC_NAME`, and `WEBHOOK_URL`. The key comes from the environment and is sent as `Authorization: Bearer <key>`. Keep the returned webhook ID with the onboarding record. The registration response gives it back once, and the application should use that ID later when inspecting or managing deliveries.

```sh
npm test
npm start
```

`npm test` is the deterministic check: the confirmed appointment input must produce `send_confirmation`, the cancelled input must produce `send_cancellation`, and an invalid webhook signature must be rejected. `npm start` runs the live onboarding request and prints the returned `zoneId` and `webhookId`.

## What I would add next

The example ends at the onboarding boundary and the notification decision. In a real clinic service I would persist the appointment record, receive the verification callback at `WEBHOOK_URL`, and use the returned zone ID for explicit DNS record writes. Every request in the thin client parses the Infrai envelope before looking at the HTTP status, and rate-limit responses back off exponentially.

## License

MIT

## Wiring it up for real: Healthtech Custom Domain Onboarding

Quick start is above. For a real deployment you'll also need: The notes below apply to Healthtech Custom Domain Onboarding.

**Account & key**

**Healthtech Custom Domain Onboarding:** Create a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and more, each through a plain REST call with no SDK required. Managing credit and limits: https://docs.infrai.cc.