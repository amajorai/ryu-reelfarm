import { describe, expect, test } from "bun:test";
import {
	demoState,
	makeReel,
	normalizeState,
	parseImportedReels,
	type ReelFarmState,
	reduceReelFarmState,
	searchReels,
	serializeState,
} from "./model";

describe("Studio model", () => {
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
