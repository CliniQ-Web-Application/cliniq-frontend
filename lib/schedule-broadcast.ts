import type { ScheduleSlot } from "./staff";

export type ScheduleBroadcastInput = { type: "DELAY" | "ABSENCE"; message: string; delayMinutes: string };

export function scheduleBroadcastBody(input: ScheduleBroadcastInput) {
  const message = input.message.trim();
  if (!message || message.length > 500) throw new Error("Enter a message of 1–500 characters.");
  if (input.type === "ABSENCE") return { type: input.type, message };
  if (input.type !== "DELAY") throw new Error("Choose a delay or absence notice.");
  const delayMinutes = Number(input.delayMinutes);
  if (!input.delayMinutes.trim() || !Number.isInteger(delayMinutes) || delayMinutes < 1 || delayMinutes > 1440) {
    throw new Error("Enter a delay of 1–1440 whole minutes.");
  }
  return { type: input.type, message, delayMinutes };
}

export function broadcastSchedules(slots: ScheduleSlot[], staffId: string): ScheduleSlot[] {
  // A browser-local date can hide a clinic window that still has waiting patients.
  return slots.filter((slot) => slot.staff?.staffId === staffId)
    .sort((left, right) => `${right.slotDate}T${right.startTime}`.localeCompare(`${left.slotDate}T${left.startTime}`));
}

export function broadcastRecipientCount(value: unknown): number {
  if (!value || typeof value !== "object" || !("recipientCount" in value)
    || typeof value.recipientCount !== "number" || !Number.isInteger(value.recipientCount) || value.recipientCount < 0) {
    throw new Error("The clinic returned an unexpected broadcast response. Check with the clinic before sending again to avoid duplicate notices.");
  }
  return value.recipientCount;
}
