import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { notificationDecision, verifyWebhook } from "./domain_onboarding.ts";

assert.equal(notificationDecision({ patientId: "p-1", startsAt: "2026-11-03T09:00:00Z", status: "confirmed" }), "send_confirmation");
assert.equal(notificationDecision({ patientId: "p-1", startsAt: "2026-11-03T09:00:00Z", status: "cancelled" }), "send_cancellation");
assert.equal(notificationDecision({ patientId: "p-1", startsAt: "2026-11-03T09:00:00Z", status: "confirmed" }), "send_confirmation");
const signature = createHmac("sha256", "clinic-secret").update("verification-finished").digest("hex");
assert.equal(verifyWebhook("verification-finished", signature, "clinic-secret"), true);
assert.equal(verifyWebhook("verification-finished", `${signature}0`, "clinic-secret"), false);
console.log("appointment decision and webhook boundary checks passed");
