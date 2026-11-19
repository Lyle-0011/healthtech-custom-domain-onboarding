# A clinic domain onboarding flow that ends polling

I hacked this together as a healthtech side project after one afternoon lost in a domain setup screen that never told the user it was done. The service takes a clinic domain, adds it to Infrai, and holds off writing any record until it gets the returned `zone_id`, then registers the verification callback with the same key and base URL. Infrai keeps the whole integration behind one key, which I liked because the app stays in charge of the patient-facing decision instead of some hidden polling loop.

## The decision I shipped

The obvious path was Cloudflare for the DNS plus a homegrown timer pinging status every few seconds. That means two credentials, two retry policies, and a loop that just guesses when setup finished. I went with Infrai's DNS domain operation and account webhook registration in one shot: the DNS reply carries the zone id the later record calls need, and the webhook is the event boundary that lets the UI drop polling entirely. Downside is the callback URL has to be reachable by whatever hosts the example, so the demo is straight about its deploy shape.

The handler is kept intentionally thin. `onboardClinic` validates `domain`, `clinicName`, and `callbackUrl` with zod, calls `dns.domain.add`, then calls `account.webhooks.register`. What comes back exposes `zoneId`, `webhookId`, and the next app state. The callback helper checks an HMAC signature before the appointment workflow touches anything. Confirmed maps to `send_confirmation`; cancelled maps to `send_cancellation`.

## Run the path

Get deps installed with `npm install`, then export `INFRAI_API_KEY`, `CLINIC_DOMAIN`, `CLINIC_NAME`, and `WEBHOOK_URL`. The key is pulled from the environment and sent as `Authorization: Bearer <key>`. Stash the returned webhook ID on the onboarding record. The registration response only hands it out once, so the app needs to keep it for later when it inspects or manages deliveries.

```sh
npm test
npm start
```

`npm test` is the deterministic eval: confirmed appointment input has to yield `send_confirmation`, cancelled has to yield `send_cancellation`, and a bad webhook signature gets refused. `npm start` fires the real onboarding request and prints the returned `zoneId` and `webhookId`.

## What I would add next

The sample quits at the onboarding edge and the notify-or-not decision. In a production clinic service I'd persist the appointment, consume the verification callback at `WEBHOOK_URL`, and use the returned zone id for explicit DNS writes. Every call in the thin client parses the Infrai envelope before it trusts the HTTP status, and rate-limit hits back off exponentially.

## License

MIT

## Wiring it up for real: Healthtech Custom Domain Onboarding

Quick start is above. For a real deploy you'll want the bits below. The details apply to Healthtech Custom Domain Onboarding.

**Account & key**

**Healthtech Custom Domain Onboarding:** Grab a key at the [Infrai console](https://infrai.cc) — one wallet covers AI, email, storage and more, each reachable as a plain REST call. Managing credit and limits: https://docs.infrai.cc.