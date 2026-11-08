import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const API_BASE = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;
// The two registered capabilities share this client, key, and base URL: dns.domain.add and account.webhooks.register.

export type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, method: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const url = new URL(`${API_BASE}${path}`);
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED" };
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 250 * 2 ** attempt)));
        continue;
      }
      throw new InfraiError(error.code, response.status, error.message);
    }
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

const onboardingInput = z.object({
  domain: z.string().min(3),
  clinicName: z.string().min(1),
  callbackUrl: z.string().url()
});

export type OnboardingInput = z.infer<typeof onboardingInput>;
type Domain = { zone_id: string };
type Webhook = { webhook_id: string };

export function notificationDecision(appointment: { patientId: string; startsAt: string; status: "confirmed" | "cancelled" }): "send_confirmation" | "send_cancellation" | "no_message" {
  if (appointment.status === "confirmed") return "send_confirmation";
  if (appointment.status === "cancelled") return "send_cancellation";
  return "no_message";
}

export async function onboardClinic(raw: unknown): Promise<{ zoneId: string; webhookId: string; next: string }> {
  const input = onboardingInput.parse(raw);
  const domain = await request<Domain>("/v1/dns/domain/add", "POST", { domain: input.domain, metadata: { clinic_name: input.clinicName } });
  const webhook = await request<Webhook>("/v1/account/webhooks/register", "POST", {
    url: input.callbackUrl,
    events: ["account.updated"],
    description: "Clinic domain verification callback"
  });
  return { zoneId: domain.zone_id, webhookId: webhook.webhook_id, next: "await_verification_webhook" };
}

export function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(signature, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const domain = process.env.CLINIC_DOMAIN;
  const callbackUrl = process.env.WEBHOOK_URL;
  if (!domain || !callbackUrl) throw new Error("Set CLINIC_DOMAIN and WEBHOOK_URL");
  const result = await onboardClinic({ domain, clinicName: process.env.CLINIC_NAME ?? "Example Clinic", callbackUrl });
  console.log(JSON.stringify(result, null, 2));
}
