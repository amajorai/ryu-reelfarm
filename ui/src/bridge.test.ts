import { afterEach, describe, expect, test } from "bun:test";
import { loadState } from "./bridge";

afterEach(() => {
	(globalThis as { window?: unknown }).window = undefined;
});

describe("Studio storage boundary", () => {
	test("starts an empty live library when host storage has no value", async () => {
		(globalThis as { window?: unknown }).window = {
			ryu: { storage: { get: () => Promise.resolve(null) } },
		};
		const loaded = await loadState();
		expect(loaded.mode).toBe("live");
		expect(loaded.state.items).toEqual([]);
	});

	test("does not fall back to preview data after live storage fails", async () => {
		(globalThis as { window?: unknown }).window = {
			ryu: { storage: { get: () => Promise.reject(new Error("denied")) } },
		};
		await expect(loadState()).rejects.toThrow("storage could not be loaded");
	});
	test("reads the legacy namespace while existing libraries migrate", async () => {
		const calls: Array<{ key: string; namespace: string }> = [];
		(globalThis as { window?: unknown }).window = {
			ryu: {
				storage: {
					get: ({ key, namespace }: { key: string; namespace: string }) => {
						calls.push({ key, namespace });
						return Promise.resolve(
							namespace === "reelfarm"
								? JSON.stringify({ items: [], version: 1 })
								: null
						);
					},
				},
			},
		};
		const loaded = await loadState();
		expect(loaded.mode).toBe("live");
		expect(loaded.state.items).toEqual([]);
		expect(calls).toEqual([
			{ key: "state.v1", namespace: "studio" },
			{ key: "state.v1", namespace: "reelfarm" },
		]);
	});
});
