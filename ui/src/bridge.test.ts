import { afterEach, describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import {
	bridgeStatus,
	generateIdeas,
	loadState,
	pickTextFile,
} from "./bridge.ts";

afterEach(() => {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: undefined,
	});
});

describe("Studio storage boundary", () => {
	test("recognizes genuine callable bridge methods from another JavaScript realm", () => {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				ryu: {
					model: { complete: runInNewContext("() => 'native'") },
					storage: {
						get: runInNewContext("() => null"),
						set: runInNewContext("() => undefined"),
					},
				},
			},
		});
		expect(bridgeStatus()).toEqual({ model: true, storage: true });
	});

	test("decodes the host's real upload result and UTF-8 data URL", async () => {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				ryu: {
					ui: {
						uploadFile: () =>
							Promise.resolve({
								data_url: "data:text/plain;base64,4piD",
								mime_type: "text/plain",
								name: "idea.txt",
								size: 3,
							}),
					},
				},
			},
		});
		expect(await pickTextFile()).toBe("☃");
	});

	test("parses a model's wrapped JSON through the existing idea normalization", async () => {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				ryu: {
					model: {
						complete: () =>
							Promise.resolve(
								'A draft: {"ideas":[{"title":" Native ","tags":[" a ",4]}]} Done.'
							),
					},
				},
			},
		});
		expect(await generateIdeas("A bounded brief", 3)).toEqual([
			{
				title: "Native",
				hook: "A clear hook goes here.",
				notes: "",
				tags: ["a"],
			},
		]);
	});
	test("starts an empty live library when host storage has no value", async () => {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				ryu: { storage: { get: () => Promise.resolve(null) } },
			},
		});
		const loaded = await loadState();
		expect(loaded.mode).toBe("live");
		expect(loaded.state.items).toEqual([]);
	});

	test("does not fall back to preview data after live storage fails", async () => {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				ryu: { storage: { get: () => Promise.reject(new Error("denied")) } },
			},
		});
		await expect(loadState()).rejects.toThrow("storage could not be loaded");
	});
	test("reads the legacy namespace while existing libraries migrate", async () => {
		const calls: Array<{ key: string; namespace: string }> = [];
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
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
			},
		});
		const loaded = await loadState();
		expect(loaded.mode).toBe("live");
		expect(loaded.state.items).toEqual([]);
		expect(calls).toEqual([
			{ key: "state.v1", namespace: "studio" },
			{ key: "state.v1", namespace: "reelfarm" },
		]);
	});
});
