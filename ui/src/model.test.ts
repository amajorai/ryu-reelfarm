import { describe, expect, test } from "bun:test";
import {
	demoState,
	makeReel,
	normalizeState,
	parseGeneratedIdeas,
	parseImportedReels,
	type ReelFarmState,
	reduceReelFarmState,
	searchReels,
	serializeState,
} from "./model.ts";
import { reelFarmStateSchema } from "./schemas.ts";

describe("Studio model", () => {
	test("keeps legacy array rows and malformed fields within the established normalization policy", () => {
		const normalized = normalizeState({
			items: [
				[],
				{
					title: " Kept ",
					createdAt: Number.POSITIVE_INFINITY,
					platform: "future",
					status: "future",
					tags: [" a ", null, "", 5, " b "],
					scheduledFor: "   ",
				},
			],
		});
		expect(normalized.items).toHaveLength(2);
		expect(normalized.items[0]?.title).toBe("Untitled idea 1");
		expect(normalized.items[1]?.title).toBe("Kept");
		expect(normalized.items[1]?.platform).toBe("Instagram");
		expect(normalized.items[1]?.status).toBe("idea");
		expect(normalized.items[1]?.tags).toEqual(["a", "b"]);
		expect(normalized.items[1]?.scheduledFor).toBeNull();
		expect(reelFarmStateSchema.safeParse(normalized).success).toBe(true);
	});

	test("bounds saved rows and generation output without dropping usable trailing fields", () => {
		const rows = Array.from({ length: 205 }, (_, index) => ({
			title: `Idea ${index}`,
			tags: ["native"],
		}));
		expect(normalizeState({ items: rows }).items).toHaveLength(200);
		const generated = parseGeneratedIdeas({ ideas: rows });
		expect(generated).toHaveLength(12);
		expect(generated[11]?.title).toBe("Idea 11");
		expect(generated[11]?.tags).toEqual(["native"]);
	});

	test("refuses incomplete persisted output while leaving tolerant imports available", () => {
		const legacy = { items: [{ title: "Legacy import" }], version: 1 };
		expect(reelFarmStateSchema.safeParse(legacy).success).toBe(false);
		const imported = parseImportedReels(JSON.stringify(legacy));
		expect(imported[0]?.title).toBe("Legacy import");
		expect(
			reelFarmStateSchema.safeParse({ items: imported, version: 1 }).success
		).toBe(true);
	});
	test("persists and normalizes bounded idea state", () => {
		const state: ReelFarmState = {
			items: [makeReel("Saved idea", { tags: ["hooks"] })],
			version: 1,
		};
		const restored = normalizeState(JSON.parse(serializeState(state)));
		expect(restored.items[0]?.title).toBe("Saved idea");
		expect(restored.items[0]?.tags).toEqual(["hooks"]);
	});

	test("searches across title, hook, notes, and tags", () => {
		const state = demoState();
		const results = searchReels(state.items, "first promise");
		expect(results.map((item) => item.title)).toEqual(["A better first frame"]);
	});

	test("updates, favorites, and deletes an idea", () => {
		const item = makeReel("Draft");
		const added = reduceReelFarmState(
			{ items: [], version: 1 },
			{ item, type: "add" }
		);
		const updated = reduceReelFarmState(added, {
			id: item.id,
			patch: { status: "ready", title: "Ready draft" },
			type: "update",
		});
		const favorited = reduceReelFarmState(updated, {
			id: item.id,
			type: "toggle-favorite",
		});
		expect(favorited.items[0]?.status).toBe("ready");
		expect(favorited.items[0]?.favorite).toBe(true);
		const deleted = reduceReelFarmState(favorited, {
			id: item.id,
			type: "delete",
		});
		expect(deleted.items).toHaveLength(0);
	});

	test("imports Vertica-style carousel slides as editable ideas", () => {
		const items = parseImportedReels(
			JSON.stringify({
				title: "A carousel",
				slides: [
					{ body: "Show the example.", title: "Start with the promise." },
				],
			})
		);
		expect(items).toHaveLength(1);
		expect(items[0]?.title).toBe("Start with the promise.");
		expect(items[0]?.status).toBe("draft");
	});
});
