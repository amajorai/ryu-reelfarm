import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
	namedAssertionIsPresent,
	reconcileLocalInteractionMap,
} from "../../../../apps-store/companion-suite.mjs";

const e2eDirectory = import.meta.dirname;
const interactionMap = JSON.parse(
	readFileSync(path.join(e2eDirectory, "companion-interactions.json"), "utf8")
);
const specSource = readFileSync(
	path.join(e2eDirectory, "reelfarm-companion.spec.ts"),
	"utf8"
);

describe("Studio package-owned Companion interaction map", () => {
	test("maps all 27 exact row identities to assertions in their named browser tests", () => {
		expect(interactionMap.scope).toBe("complete");
		expect(interactionMap.expectedRows).toBe(27);
		expect(interactionMap.assertions).toHaveLength(27);

		const censusRows = interactionMap.assertions.map(
			(assertion) => assertion.row
		);
		const reconciled = reconcileLocalInteractionMap(
			"reelfarm",
			censusRows,
			interactionMap
		);
		expect(reconciled).toHaveLength(27);

		const identities = new Set(
			reconciled.map(({ row }) =>
				["package", "source_file", "line", "component", "tag", "events"]
					.map((field) => String(row[field]))
					.join("\u0000")
			)
		);
		expect(identities.size).toBe(27);

		for (const { assertion } of reconciled) {
			expect(
				namedAssertionIsPresent(
					specSource,
					assertion.testTitle,
					assertion.assertionMarker
				)
			).toBe(true);
		}
	});

	test("rejects duplicate, stale, and missing row identities", () => {
		const rows = interactionMap.assertions.map((assertion) => assertion.row);
		const first = interactionMap.assertions[0];
		if (!first) {
			throw new Error("The complete Studio interaction map is empty.");
		}

		expect(() =>
			reconcileLocalInteractionMap("reelfarm", rows, {
				...interactionMap,
				assertions: [...interactionMap.assertions, { ...first }],
				expectedRows: 28,
				scope: "partial",
			})
		).toThrow("duplicates an interaction identity");

		const staleAssertions = interactionMap.assertions.map((assertion, index) =>
			index === 0
				? { ...assertion, row: { ...assertion.row, line: "999" } }
				: assertion
		);
		expect(() =>
			reconcileLocalInteractionMap("reelfarm", rows, {
				...interactionMap,
				assertions: staleAssertions,
			})
		).toThrow("does not match exactly one current central census row");

		expect(() =>
			reconcileLocalInteractionMap("reelfarm", rows, {
				...interactionMap,
				assertions: interactionMap.assertions.slice(1),
			})
		).toThrow("expected 27 rows but contains 26");
	});

	test("a complete map rejects omission from the row inventory", () => {
		const rows = interactionMap.assertions
			.slice(0, -1)
			.map((assertion) => assertion.row);
		expect(() =>
			reconcileLocalInteractionMap("reelfarm", rows, interactionMap)
		).toThrow("complete interaction map expects 27 central rows but found 26");
	});
});
