import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { FrameLocator, Page } from "@playwright/test";
// The browser selector is imported from "@playwright/test" through the shared desktop dependency.
import { expect, test } from "@playwright/test";
import { reelFarmStateSchema, storageWriteSchema } from "../src/schemas.ts";
import type { ReelfarmSnapshot } from "./fixture-types.ts";

const EVIDENCE_DIRECTORY = path.resolve(import.meta.dirname, "../evidence");

function appFrame(page: Page): FrameLocator {
	return page.frameLocator('iframe[title="Studio"]');
}

async function fixtureSnapshot(page: Page): Promise<ReelfarmSnapshot> {
	return page.evaluate(() => {
		const fixture = window.__reelfarmFixture;
		if (!fixture) {
			throw new Error("The local Studio fixture is not installed.");
		}
		return {
			calls: [...fixture.calls],
			exports: [...fixture.exports],
			stored: fixture.getStored("studio", "state.v1"),
		};
	});
}

async function installDownloadObserver(page: Page): Promise<void> {
	await page.addInitScript(() => {
		if (window.parent === window) {
			return;
		}
		const createObjectURL = URL.createObjectURL.bind(URL);
		const clickAnchor = HTMLAnchorElement.prototype.click;
		let mostRecentBlob: { body: Promise<string>; href: string } | null = null;
		URL.createObjectURL = (value) => {
			const href = createObjectURL(value);
			if (value instanceof Blob) {
				mostRecentBlob = { body: value.text(), href };
			}
			return href;
		};
		HTMLAnchorElement.prototype.click = function click() {
			const blob = mostRecentBlob;
			if (blob && this.href === blob.href && this.download) {
				const filename = this.download;
				const href = this.href;
				void blob.body.then((body) => {
					window.parent.postMessage(
						{ body, filename, href, type: "reelfarm-export-attempt" },
						"*"
					);
				});
			}
			return clickAnchor.call(this);
		};
	});
}

async function saveProductScreenshot(page: Page, name: string): Promise<void> {
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await page.locator('iframe[title="Studio"]').screenshot({
		animations: "disabled",
		path: path.join(EVIDENCE_DIRECTORY, name),
	});
}

async function createIdea(
	app: ReturnType<typeof appFrame>,
	title: string
): Promise<void> {
	await app.getByRole("button", { name: "New idea" }).click();
	const dialog = app.getByRole("dialog");
	await dialog.getByLabel("Title").fill(title);
	await dialog.getByRole("button", { name: "Add to farm" }).click();
	await expect(
		app.getByRole("heading", { name: title, exact: true })
	).toBeVisible();
}

test("creates, edits, favorites, filters, exports, and reloads a local idea", async ({
	page,
}) => {
	const browserErrors: string[] = [];
	page.on("pageerror", (error) => browserErrors.push(error.message));
	await installDownloadObserver(page);
	await page.goto("/");
	const app = appFrame(page);

	await expect(
		app.getByRole("heading", { name: "Content queue" })
	).toBeVisible();
	await expect(
		app.getByText(
			"Local planning only · no social platform publishing or scheduler is connected.",
			{ exact: true }
		)
	).toBeVisible();
	await app.getByRole("button", { name: "Add your first idea" }).click();
	const composer = app.getByRole("dialog");
	await expect(
		composer.getByText(
			"Keep the promise, the visual, and the next action in one place.",
			{ exact: true }
		)
	).toBeVisible();
	await composer.getByLabel("Title").fill("A weekly insight");
	await composer.getByLabel("Hook").fill("Turn the opener into the promise.");
	await composer.getByLabel("Platform").selectOption("TikTok");
	await composer.getByLabel("Publish slot").fill("2026-10-01T09:30");
	await composer.getByLabel("Tags").fill("hooks, workflow");
	await composer
		.getByPlaceholder("Visual direction or supporting context")
		.fill("Ask Maya to share the live demo.");
	await expect(composer.getByLabel("Title")).toHaveValue("A weekly insight");
	await expect(composer.getByLabel("Hook")).toHaveValue(
		"Turn the opener into the promise."
	);
	await expect(composer.getByLabel("Platform")).toHaveValue("TikTok");
	await expect(composer.getByLabel("Publish slot")).toHaveValue(
		"2026-10-01T09:30"
	);
	await expect(composer.getByLabel("Tags")).toHaveValue("hooks, workflow");
	await expect(
		composer.getByPlaceholder("Visual direction or supporting context")
	).toHaveValue("Ask Maya to share the live demo.");
	await composer.getByRole("button", { name: "Add to farm" }).click();
	await expect(
		app.getByText("Idea added to the farm.", { exact: true })
	).toBeVisible();
	await expect(
		app.getByRole("heading", { name: "A weekly insight", exact: true })
	).toBeVisible();
	await expect(app.getByText("#hooks", { exact: true })).toBeVisible();
	await expect(app.getByText("#workflow", { exact: true })).toBeVisible();

	await app
		.getByRole("button", { name: "Add A weekly insight favorite" })
		.click();
	await expect(
		app.getByRole("button", { name: "Remove A weekly insight favorite" })
	).toHaveAttribute("aria-pressed", "true");
	await app
		.getByLabel("Move A weekly insight", { exact: true })
		.selectOption("ready");
	await expect(
		app.getByRole("heading", { name: "Ready", exact: true })
	).toBeVisible();

	await app.getByRole("button", { name: "Edit", exact: true }).click();
	const editDialog = app.getByRole("dialog");
	await expect(
		editDialog.getByRole("heading", { name: "Edit idea" })
	).toBeVisible();
	await expect(editDialog.getByLabel("Platform")).toHaveValue("TikTok");
	await expect(editDialog.getByLabel("Publish slot")).toHaveValue(
		"2026-10-01T09:30"
	);
	await expect(editDialog.getByLabel("Tags")).toHaveValue("hooks, workflow");
	await editDialog.getByLabel("Title").fill("A weekly insight refreshed");
	await editDialog
		.getByPlaceholder("Visual direction or supporting context")
		.fill("Ask Maya to share the updated demo.");
	await editDialog.getByRole("button", { name: "Save changes" }).click();
	await expect(
		app.getByRole("heading", {
			name: "A weekly insight refreshed",
			exact: true,
		})
	).toBeVisible();
	await expect(
		app
			.locator(".reelfarm-board")
			.getByText("Ask Maya to share the updated demo.", { exact: true })
	).toBeVisible();

	const search = app.getByLabel("Search ideas, hooks, and notes");
	await search.fill("Maya");
	await expect(app.locator(".reelfarm-results-count")).toHaveText("1 result");
	await app.getByLabel("Filter ideas").selectOption("favorites");
	await expect(
		app.getByRole("heading", { name: "A weekly insight refreshed" })
	).toBeVisible();
	await app.getByLabel("Filter ideas").selectOption("ready");
	await expect(app.locator(".reelfarm-results-count")).toHaveText("1 result");
	await search.fill("");
	await app.getByLabel("Filter ideas").selectOption("all");

	await app.getByRole("button", { name: "Export JSON" }).click();
	await expect
		.poll(async () => (await fixtureSnapshot(page)).exports.at(-1)?.filename)
		.toBe("studio.json");
	const exportAttempt = (await fixtureSnapshot(page)).exports.at(-1);
	expect(exportAttempt?.href).toMatch(/^blob:/);
	const exported = reelFarmStateSchema.parse(
		JSON.parse(exportAttempt?.body ?? "null")
	);
	expect(exported.items).toContainEqual(
		expect.objectContaining({
			favorite: true,
			hook: "Turn the opener into the promise.",
			notes: "Ask Maya to share the updated demo.",
			platform: "TikTok",
			scheduledFor: "2026-10-01T09:30",
			status: "ready",
			tags: ["hooks", "workflow"],
			title: "A weekly insight refreshed",
		})
	);
	await expect
		.poll(async () => {
			const snapshot = await fixtureSnapshot(page);
			return snapshot.stored
				? reelFarmStateSchema.parse(JSON.parse(snapshot.stored))
				: null;
		})
		.toMatchObject({
			items: [
				expect.objectContaining({
					favorite: true,
					status: "ready",
					title: "A weekly insight refreshed",
				}),
			],
		});
	const saveCall = (await fixtureSnapshot(page)).calls.findLast(
		(call) => call.method === "storage.set"
	);
	const saveInput = storageWriteSchema.safeParse(saveCall?.input).data;
	expect(saveInput).toMatchObject({ key: "state.v1", namespace: "studio" });
	expect(JSON.parse(saveInput?.value ?? "null")).toMatchObject({
		items: [
			expect.objectContaining({
				notes: "Ask Maya to share the updated demo.",
				scheduledFor: "2026-10-01T09:30",
				title: "A weekly insight refreshed",
			}),
		],
	});

	await page.reload();
	const restored = appFrame(page);
	await expect(
		restored.getByRole("heading", {
			name: "A weekly insight refreshed",
			exact: true,
		})
	).toBeVisible();
	await expect(
		restored.getByRole("button", {
			name: "Remove A weekly insight refreshed favorite",
		})
	).toHaveAttribute("aria-pressed", "true");
	await expect(
		restored.getByLabel("Move A weekly insight refreshed", { exact: true })
	).toHaveValue("ready");
	await saveProductScreenshot(page, "studio-library-persisted.png");
	expect(browserErrors).toEqual([]);
});

test("New idea can be dismissed without saving a draft", async ({ page }) => {
	await page.goto("/");
	const app = appFrame(page);
	await app.getByRole("button", { name: "New idea" }).click();
	const dialog = app.getByRole("dialog");
	await expect(dialog.getByRole("heading", { name: "New idea" })).toBeVisible();
	await dialog.getByLabel("Title").fill("Unsaved outline");
	await dialog.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(
		app.getByRole("heading", { name: "Unsaved outline", exact: true })
	).toHaveCount(0);

	await app.getByRole("button", { name: "New idea" }).click();
	const canceledDialog = app.getByRole("dialog");
	await canceledDialog.getByLabel("Title").fill("Another unsaved outline");
	await canceledDialog.getByRole("button", { name: "Cancel" }).click();
	await expect(canceledDialog).toBeHidden();
	await expect(
		app.getByRole("heading", { name: "Another unsaved outline", exact: true })
	).toHaveCount(0);
});

test("Import JSON reports invalid data and succeeds after the file is corrected", async ({
	page,
}) => {
	await page.goto("/");
	const app = appFrame(page);
	const firstPicker = page.waitForEvent("filechooser");
	await app.getByRole("button", { name: "Import JSON" }).click();
	const firstFileChooser = await firstPicker;
	expect(await firstFileChooser.element().getAttribute("accept")).toBe(
		"application/json,.json,text/plain"
	);
	expect(await firstFileChooser.isMultiple()).toBe(false);
	await firstFileChooser.setFiles({
		buffer: Buffer.from("this is not JSON"),
		mimeType: "application/json",
		name: "broken.json",
	});
	await expect(
		app.getByRole("button", { name: "Dismiss notice" })
	).toContainText("That is not valid Studio JSON.");
	await app.getByRole("button", { name: "Dismiss notice" }).click();
	await expect(app.getByRole("button", { name: "Dismiss notice" })).toHaveCount(
		0
	);
	const correctedPicker = page.waitForEvent("filechooser");
	await app.getByRole("button", { name: "Import JSON" }).click();
	const correctedFileChooser = await correctedPicker;
	expect(await correctedFileChooser.element().getAttribute("accept")).toBe(
		"application/json,.json,text/plain"
	);
	await correctedFileChooser.setFiles({
		buffer: Buffer.from(
			JSON.stringify({
				slides: [
					{
						body: "Show the before and after.",
						headline: "Name the outcome first.",
						title: "A stronger opening frame",
					},
				],
			})
		),
		mimeType: "application/json",
		name: "corrected.json",
	});
	await expect(
		app.getByRole("heading", { name: "A stronger opening frame", exact: true })
	).toBeVisible();
	await expect(
		app.getByText("Name the outcome first.", { exact: true })
	).toBeVisible();
	await expect(app.getByText("#carousel", { exact: true })).toBeVisible();
	await expect(
		app.getByText("Imported 1 idea.", { exact: true })
	).toBeVisible();
	await expect
		.poll(async () => {
			const snapshot = await fixtureSnapshot(page);
			return snapshot.stored
				? reelFarmStateSchema.parse(JSON.parse(snapshot.stored))
				: null;
		})
		.toMatchObject({
			items: [
				expect.objectContaining({
					hook: "Name the outcome first.",
					status: "draft",
					title: "A stronger opening frame",
				}),
			],
		});
});

test("Generation sends the requested brief, recovers from a provider error, and stays editable", async ({
	page,
}) => {
	await page.goto("/");
	const app = appFrame(page);
	const brief = "a weekly research ritual for small teams";
	await app.getByLabel("Generation brief").fill(brief);
	const generate = app.getByRole("button", { name: "Draft 3 ideas" });
	await expect(generate).toBeEnabled();
	await generate.click();
	await expect(
		app.getByRole("button", { name: "Dismiss notice" })
	).toContainText("The local model fixture is temporarily unavailable.");
	await expect(generate).toBeEnabled();
	const firstModelCall = (await fixtureSnapshot(page)).calls.find(
		(call) => call.method === "model.complete"
	);
	expect(firstModelCall?.input).toMatchObject({
		effort: "medium",
		prompt: expect.stringContaining(
			`Create 3 short-form content ideas for: ${brief}.`
		),
		system:
			"You are a concise content editor. Return only valid JSON. Never include markdown fences or HTML.",
	});
	await generate.click();
	await expect(
		app.getByRole("heading", { name: "A clearer handoff", exact: true })
	).toBeVisible();
	await expect(
		app.getByRole("heading", { name: "The one-minute setup", exact: true })
	).toBeVisible();
	await expect(
		app.getByText("3 draft ideas added.", { exact: true })
	).toBeVisible();
	const modelCalls = (await fixtureSnapshot(page)).calls.filter(
		(call) => call.method === "model.complete"
	);
	expect(modelCalls).toHaveLength(2);
	expect(modelCalls[1]?.input).toMatchObject({
		effort: "medium",
		prompt: expect.stringContaining(brief),
	});

	await app.getByRole("button", { name: "Edit", exact: true }).first().click();
	const generatedEdit = app.getByRole("dialog");
	await expect(generatedEdit.getByLabel("Hook")).toHaveValue(
		"Start with the next owner."
	);
	await generatedEdit.getByLabel("Hook").fill("Make the next owner obvious.");
	await generatedEdit.getByRole("button", { name: "Save changes" }).click();
	await expect(
		app
			.locator(".reelfarm-board")
			.getByText("Make the next owner obvious.", { exact: true })
	).toBeVisible();
	await app.getByRole("button", { name: "Dismiss notice" }).click();
	await expect(app.getByRole("button", { name: "Dismiss notice" })).toHaveCount(
		0
	);
});

test("Delete confirmation can be escaped, canceled, or committed for only one idea", async ({
	page,
}) => {
	await page.goto("/");
	const app = appFrame(page);
	await createIdea(app, "First local idea");
	await createIdea(app, "Second local idea");
	const firstCard = app.locator(".reelfarm-card").filter({
		has: app.getByRole("heading", {
			name: "First local idea",
			exact: true,
		}),
	});

	await firstCard.getByRole("button", { name: "Delete", exact: true }).click();
	const deleteDialog = app.getByRole("dialog", { name: "Delete this idea?" });
	await expect(deleteDialog).toContainText(
		"This removes it from the local publishing queue."
	);
	await deleteDialog.press("Escape");
	await expect(deleteDialog).toBeHidden();
	await expect(
		app.getByRole("heading", { name: "First local idea", exact: true })
	).toBeVisible();

	await firstCard.getByRole("button", { name: "Delete", exact: true }).click();
	await app
		.getByRole("dialog", { name: "Delete this idea?" })
		.getByRole("button", { name: "Keep idea" })
		.click();
	await expect(deleteDialog).toBeHidden();
	await expect(
		app.getByRole("heading", { name: "First local idea", exact: true })
	).toBeVisible();

	await firstCard.getByRole("button", { name: "Delete", exact: true }).click();
	await app
		.getByRole("dialog", { name: "Delete this idea?" })
		.getByRole("button", { name: "Delete idea" })
		.click();
	await expect(
		app.getByRole("heading", { name: "First local idea", exact: true })
	).toHaveCount(0);
	await expect(
		app.getByRole("heading", { name: "Second local idea", exact: true })
	).toBeVisible();
	await expect(
		app.getByRole("button", { name: "Dismiss notice" })
	).toContainText("Idea deleted.");
	await app.getByRole("button", { name: "Dismiss notice" }).click();
	await expect(app.getByRole("button", { name: "Dismiss notice" })).toHaveCount(
		0
	);
	await expect
		.poll(async () => {
			const snapshot = await fixtureSnapshot(page);
			if (!snapshot.stored) {
				return [];
			}
			return reelFarmStateSchema
				.parse(JSON.parse(snapshot.stored))
				.items.map((item) => item.title);
		})
		.toEqual(["Second local idea"]);
});
