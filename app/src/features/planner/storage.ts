import { z } from "zod";
import {
  DEFAULT_PLAN_INPUTS,
  LifeEventSchema,
  type LifeEvent,
  type PlanInputs
} from "@app/core";

const STORAGE_KEY = "planner.inputs.v1";

const EventsSchema = z.array(LifeEventSchema);

export function loadInputs(): PlanInputs {
  if (typeof window === "undefined") return DEFAULT_PLAN_INPUTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAN_INPUTS;
    const parsed = JSON.parse(raw) as Partial<PlanInputs> & {
      events?: unknown;
    };
    // Legacy plans (saved before events existed) won't carry the field at
    // all; the spread + default lets them hydrate to []. When events ARE
    // present, validate the array so a malformed entry can't crash the
    // projection — fall back to [] instead of returning all defaults so
    // the user keeps their other settings.
    let events: LifeEvent[] = [];
    if (parsed.events !== undefined) {
      const result = EventsSchema.safeParse(parsed.events);
      if (result.success) events = result.data;
    }
    return { ...DEFAULT_PLAN_INPUTS, ...parsed, events };
  } catch {
    return DEFAULT_PLAN_INPUTS;
  }
}

export function saveInputs(inputs: PlanInputs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    // Silently ignore storage errors (quota, private mode, etc.).
  }
}

export function clearInputs(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
