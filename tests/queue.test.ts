import { describe, it, expect } from "vitest";
import { canTransition } from "@/lib/queue";

describe("Render job státusz-átmenetek", () => {
  it("QUEUED → CLAIMED oké", () => { expect(canTransition("QUEUED", "CLAIMED")).toBe(true); });
  it("SUCCEEDED terminális", () => { expect(canTransition("SUCCEEDED", "QUEUED")).toBe(false); });
  it("FAILED újraqueuezható", () => { expect(canTransition("FAILED", "QUEUED")).toBe(true); });
  it("RUNNING → RETRY_WAIT oké", () => { expect(canTransition("RUNNING", "RETRY_WAIT")).toBe(true); });
  it("CANCELLED terminális", () => { expect(canTransition("CANCELLED", "QUEUED")).toBe(false); });
});
