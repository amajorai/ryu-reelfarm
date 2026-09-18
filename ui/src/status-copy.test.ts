import { describe, expect, test } from "bun:test";
import { REEL_STATUS_COPY } from "./status-copy";

describe("Studio status copy", () => {
	test("keeps manually recorded statuses separate from platform delivery", () => {
		expect(REEL_STATUS_COPY.published.label).toBe("Marked published");
		expect(REEL_STATUS_COPY.published.hint).toContain("no platform delivery");
		expect(REEL_STATUS_COPY.scheduled.label).toBe("Planned slot");
		expect(REEL_STATUS_COPY.scheduled.hint).toContain("no scheduler");
	});
});
