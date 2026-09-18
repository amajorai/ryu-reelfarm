export const REEL_PLATFORMS = [
	"Instagram",
	"TikTok",
	"YouTube Shorts",
	"LinkedIn",
] as const;

export type ReelPlatform = (typeof REEL_PLATFORMS)[number];

export const REEL_STATUSES = [
	"idea",
	"draft",
	"ready",
	"scheduled",
	"published",
] as const;

export type ReelStatus = (typeof REEL_STATUSES)[number];

export interface ReelItem {
	createdAt: number;
	favorite: boolean;
	hook: string;
	id: string;
	notes: string;
	platform: ReelPlatform;
	scheduledFor: string | null;
	status: ReelStatus;
	tags: string[];
	title: string;
	updatedAt: number;
}

export interface ReelFarmState {
	items: ReelItem[];
	version: 1;
}

export type ReelPatch = Partial<
	Pick<
		ReelItem,
		"hook" | "notes" | "platform" | "scheduledFor" | "status" | "tags" | "title"
	>
>;

export type ReelFarmAction =
	| { item: ReelItem; type: "add" }
	| { id: string; type: "delete" }
	| { id: string; patch: ReelPatch; type: "update" }
	| { id: string; type: "toggle-favorite" }
	| { id: string; status: ReelStatus; type: "set-status" };

export interface GeneratedIdea {
	hook: string;
	notes: string;
	tags: string[];
	title: string;
}

const MAX_ITEMS = 200;
const MAX_TEXT = 600;
const DEFAULT_PLATFORM: ReelPlatform = "Instagram";
const DEFAULT_STATUS: ReelStatus = "idea";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stringValue(
	value: unknown,
	fallback: string,
	limit = MAX_TEXT
): string {
	return typeof value === "string" ? value.trim().slice(0, limit) : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function platformValue(value: unknown): ReelPlatform {
	return REEL_PLATFORMS.includes(value as ReelPlatform)
		? (value as ReelPlatform)
		: DEFAULT_PLATFORM;
}

function statusValue(value: unknown): ReelStatus {
	return REEL_STATUSES.includes(value as ReelStatus)
		? (value as ReelStatus)
		: DEFAULT_STATUS;
}

function tagsValue(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.filter((tag): tag is string => typeof tag === "string")
		.map((tag) => tag.trim().slice(0, 32))
		.filter(Boolean)
		.slice(0, 12);
}

function makeId(prefix: string): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	return uuid
		? `${prefix}-${uuid.slice(0, 8)}`
		: `${prefix}-${Date.now().toString(36)}`;
}

function normalizeItem(value: unknown, index: number): ReelItem | null {
	if (!isRecord(value)) {
		return null;
	}
	const now = Date.now();
	const id = stringValue(value.id, `reel-${index}`, 80) || `reel-${index}`;
	return {
		createdAt: numberValue(value.createdAt, now),
		favorite: booleanValue(value.favorite, false),
		hook: stringValue(value.hook, "A clear hook goes here."),
		id,
		notes: stringValue(value.notes, ""),
		platform: platformValue(value.platform),
		scheduledFor:
			typeof value.scheduledFor === "string" && value.scheduledFor.trim()
				? value.scheduledFor.trim().slice(0, 64)
				: null,
		status: statusValue(value.status),
		tags: tagsValue(value.tags),
		title: stringValue(value.title, `Untitled idea ${index + 1}`),
		updatedAt: numberValue(value.updatedAt, now),
	};
}

export function emptyState(): ReelFarmState {
	return { items: [], version: 1 };
}

export function demoState(): ReelFarmState {
	const first = makeReel("A better first frame", {
		hook: "Your opening line is a promise, not a greeting.",
		notes: "Turn the first sentence into the reason to keep watching.",
		status: "ready",
		tags: ["hooks", "carousel"],
	});
	const second = makeReel("The two-minute content system", {
		hook: "A tiny publishing ritual beats a heroic content sprint.",
		notes: "Record one observation, one example, and one next step.",
		platform: "LinkedIn",
		status: "draft",
		tags: ["workflow"],
	});
	return { items: [first, second], version: 1 };
}

export function normalizeState(value: unknown): ReelFarmState {
	if (!(isRecord(value) && Array.isArray(value.items))) {
		return emptyState();
	}
	return {
		items: value.items
			.slice(0, MAX_ITEMS)
			.map(normalizeItem)
			.filter((item): item is ReelItem => item !== null),
		version: 1,
	};
}

export function serializeState(state: ReelFarmState): string {
	return JSON.stringify(
		{
			items: state.items.slice(0, MAX_ITEMS),
			version: 1,
		},
		null,
		2
	);
}

function patchItem(item: ReelItem, patch: ReelPatch): ReelItem {
	return {
		...item,
		...patch,
		hook: stringValue(patch.hook, item.hook),
		notes: stringValue(patch.notes, item.notes),
		platform: platformValue(patch.platform ?? item.platform),
		scheduledFor:
			patch.scheduledFor === null
				? null
				: stringValue(patch.scheduledFor, item.scheduledFor ?? "", 64) || null,
		status: statusValue(patch.status ?? item.status),
		tags: patch.tags ? tagsValue(patch.tags) : item.tags,
		title: stringValue(patch.title, item.title),
		updatedAt: Date.now(),
	};
}

export function reduceReelFarmState(
	state: ReelFarmState,
	action: ReelFarmAction
): ReelFarmState {
	switch (action.type) {
		case "add":
			return {
				...state,
				items: [action.item, ...state.items].slice(0, MAX_ITEMS),
			};
		case "delete":
			return {
				...state,
				items: state.items.filter((item) => item.id !== action.id),
			};
		case "toggle-favorite":
			return {
				...state,
				items: state.items.map((item) =>
					item.id === action.id
						? { ...item, favorite: !item.favorite, updatedAt: Date.now() }
						: item
				),
			};
		case "set-status":
			return {
				...state,
				items: state.items.map((item) =>
					item.id === action.id
						? patchItem(item, { status: action.status })
						: item
				),
			};
		case "update":
			return {
				...state,
				items: state.items.map((item) =>
					item.id === action.id ? patchItem(item, action.patch) : item
				),
			};
	}
}

export function makeReel(
	title = "Untitled idea",
	options: Partial<
		Omit<ReelItem, "createdAt" | "id" | "title" | "updatedAt">
	> = {}
): ReelItem {
	const now = Date.now();
	return {
		createdAt: now,
		favorite: options.favorite ?? false,
		hook: options.hook ?? "A clear hook goes here.",
		id: makeId("reel"),
		notes: options.notes ?? "",
		platform: options.platform ?? DEFAULT_PLATFORM,
		scheduledFor: options.scheduledFor ?? null,
		status: options.status ?? DEFAULT_STATUS,
		tags: options.tags ?? [],
		title: title.trim() || "Untitled idea",
		updatedAt: now,
	};
}

export function searchReels(items: ReelItem[], query: string): ReelItem[] {
	const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) {
		return items;
	}
	return items
		.map((item) => {
			const title = item.title.toLowerCase();
			const haystack = [
				item.title,
				item.hook,
				item.notes,
				item.platform,
				item.status,
				...item.tags,
			]
				.join(" ")
				.toLowerCase();
			const matches = tokens.every((token) => haystack.includes(token));
			const score = tokens.reduce(
				(total, token) =>
					total +
					(title.includes(token) ? 3 : haystack.includes(token) ? 1 : 0),
				0
			);
			return { item, matches, score };
		})
		.filter((result) => result.matches)
		.sort((left, right) => right.score - left.score)
		.map((result) => result.item);
}

export function parseImportedReels(raw: string): ReelItem[] {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw new Error("That is not valid Studio JSON.");
	}
	if (!isRecord(value)) {
		throw new Error("The import must be a JSON object.");
	}
	if (Array.isArray(value.items)) {
		const items = normalizeState({ items: value.items }).items;
		if (items.length > 0) {
			return items;
		}
	}
	if (Array.isArray(value.slides)) {
		const slides = value.slides
			.filter(isRecord)
			.slice(0, 50)
			.map((slide, index) =>
				makeReel(stringValue(slide.title, `Carousel frame ${index + 1}`), {
					hook: stringValue(
						slide.headline,
						stringValue(slide.title, "A clear idea")
					),
					notes: stringValue(slide.body, ""),
					status: "draft",
					tags: ["carousel"],
				})
			);
		if (slides.length > 0) {
			return slides;
		}
	}
	throw new Error("The import has no usable ideas or slides.");
}

export function parseGeneratedIdeas(value: unknown): GeneratedIdea[] {
	if (!(isRecord(value) && Array.isArray(value.ideas))) {
		return [];
	}
	return value.ideas
		.filter(isRecord)
		.map((idea) => ({
			hook: stringValue(idea.hook, "A clear hook goes here."),
			notes: stringValue(idea.notes, ""),
			tags: tagsValue(idea.tags),
			title: stringValue(idea.title, "Untitled idea", 160),
		}))
		.slice(0, 12);
}

export function generationPrompt(brief: string, count: number): string {
	return [
		"Return JSON only with this shape: {ideas:[{title:string,hook:string,notes:string,tags:string[]}] }.",
		`Create ${Math.min(12, Math.max(1, Math.round(count)))} short-form content ideas for: ${brief.trim() || "a useful idea"}.`,
		"Make each title specific, each hook speakable in one breath, and each note suggest a concrete visual or example.",
	].join("\n");
}
