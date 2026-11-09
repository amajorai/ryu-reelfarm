import {
	makeReel,
	type ReelFarmState,
	type ReelItem,
	type ReelPlatform,
	type ReelStatus,
	serializeState,
} from "./model.ts";

export type Filter = "all" | "favorites" | ReelStatus;

export interface FormState {
	hook: string;
	notes: string;
	platform: ReelPlatform;
	scheduledFor: string;
	tags: string;
	title: string;
}

export const EMPTY_FORM: FormState = {
	hook: "",
	notes: "",
	platform: "Instagram",
	scheduledFor: "",
	tags: "",
	title: "",
};

export function toForm(item: ReelItem): FormState {
	return {
		hook: item.hook,
		notes: item.notes,
		platform: item.platform,
		scheduledFor: item.scheduledFor ?? "",
		tags: item.tags.join(", "),
		title: item.title,
	};
}

export function parseTags(value: string): string[] {
	return value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean)
		.slice(0, 12);
}

export function rekeyImportedItems(
	items: ReelItem[],
	existingIds: Set<string>
): ReelItem[] {
	return items.map((item) => {
		let id = item.id;
		while (existingIds.has(id)) {
			id = makeReel().id;
		}
		existingIds.add(id);
		return { ...item, id };
	});
}

function safeFileName(value: string): string {
	return (
		value
			.trim()
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "studio"
	);
}

export function downloadJson(state: ReelFarmState): void {
	const blob = new Blob([serializeState(state)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.download = `${safeFileName("studio")}.json`;
	anchor.href = url;
	anchor.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
