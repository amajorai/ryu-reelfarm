import type { GeneratedIdea, ReelFarmState } from "./model";
import {
	demoState,
	emptyState,
	generationPrompt,
	normalizeState,
	parseGeneratedIdeas,
	serializeState,
} from "./model";

const STORAGE_NAMESPACE = "studio";
const LEGACY_STORAGE_NAMESPACE = "reelfarm";
const STORAGE_KEY = "state.v1";

function safeLocalStorageGet(key: string): string | null {
	try {
		return globalThis.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeLocalStorageSet(key: string, value: string): void {
	try {
		globalThis.localStorage.setItem(key, value);
	} catch {
		// A null-origin preview may not expose localStorage.
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export interface BridgeStatus {
	model: boolean;
	storage: boolean;
}

export type AppMode = "demo" | "live";

export function bridgeStatus(): BridgeStatus {
	const bridge = window.ryu;
	return {
		model: typeof bridge?.model?.complete === "function",
		storage:
			typeof bridge?.storage?.get === "function" &&
			typeof bridge.storage.set === "function",
	};
}

export async function loadState(): Promise<{
	mode: AppMode;
	state: ReelFarmState;
}> {
	const current = typeof window === "undefined" ? undefined : window.ryu;
	if (!current) {
		const local =
			safeLocalStorageGet(`${STORAGE_NAMESPACE}:${STORAGE_KEY}`) ??
			safeLocalStorageGet(`${LEGACY_STORAGE_NAMESPACE}:${STORAGE_KEY}`);
		if (!local) {
			return { mode: "demo", state: demoState() };
		}
		try {
			return { mode: "demo", state: normalizeState(JSON.parse(local)) };
		} catch {
			return { mode: "demo", state: demoState() };
		}
	}
	if (!current.storage?.get) {
		throw new Error("Studio storage is unavailable on this host.");
	}
	try {
		const value =
			(await current.storage.get({
				key: STORAGE_KEY,
				namespace: STORAGE_NAMESPACE,
			})) ??
			(await current.storage.get({
				key: STORAGE_KEY,
				namespace: LEGACY_STORAGE_NAMESPACE,
			}));
		return {
			mode: "live",
			state: value ? normalizeState(JSON.parse(value)) : emptyState(),
		};
	} catch {
		throw new Error(
			"Studio storage could not be loaded. Reload before editing."
		);
	}
}

export async function saveState(state: ReelFarmState): Promise<void> {
	const value = serializeState(state);
	const current = typeof window === "undefined" ? undefined : window.ryu;
	if (!current) {
		safeLocalStorageSet(`${STORAGE_NAMESPACE}:${STORAGE_KEY}`, value);
		return;
	}
	if (!current.storage?.set) {
		throw new Error("Studio storage is unavailable on this host.");
	}
	await current.storage.set({
		key: STORAGE_KEY,
		namespace: STORAGE_NAMESPACE,
		value,
	});
}

export function dataUrlToText(dataUrl: string): string {
	const separator = dataUrl.indexOf(",");
	if (separator < 0) {
		throw new Error("The selected file is not a readable data URL.");
	}
	const metadata = dataUrl.slice(0, separator);
	const payload = dataUrl.slice(separator + 1);
	if (!metadata.includes(";base64")) {
		return decodeURIComponent(payload);
	}
	const bytes = atob(payload);
	let encoded = "";
	for (let index = 0; index < bytes.length; index += 8192) {
		encoded += Array.from(bytes.slice(index, index + 8192))
			.map(
				(character) =>
					`%${character.charCodeAt(0).toString(16).padStart(2, "0")}`
			)
			.join("");
	}
	return decodeURIComponent(encoded);
}

export async function pickTextFile(): Promise<string | null> {
	const hostPicker = window.ryu?.ui?.uploadFile;
	if (hostPicker) {
		const result = await hostPicker({
			accept: "application/json,.json,text/plain",
			multiple: false,
		});
		const item = Array.isArray(result) ? result[0] : result;
		return item && typeof item.data_url === "string"
			? dataUrlToText(item.data_url)
			: null;
	}
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.accept = "application/json,.json,text/plain";
		input.type = "file";
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			const reader = new FileReader();
			reader.addEventListener("load", () =>
				resolve(typeof reader.result === "string" ? reader.result : null)
			);
			reader.addEventListener("error", () => resolve(null));
			reader.readAsText(file);
		});
		input.click();
	});
}

export async function generateIdeas(
	brief: string,
	count: number
): Promise<GeneratedIdea[]> {
	const complete = window.ryu?.model?.complete;
	if (!complete) {
		throw new Error("Ryu model generation is not available.");
	}
	const raw = await complete({
		effort: "medium",
		prompt: generationPrompt(brief, count),
		system:
			"You are a concise content editor. Return only valid JSON. Never include markdown fences or HTML.",
	});
	const trimmed = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		const start = trimmed.indexOf("{");
		const end = trimmed.lastIndexOf("}");
		parsed =
			start >= 0 && end > start
				? JSON.parse(trimmed.slice(start, end + 1))
				: null;
	}
	return parseGeneratedIdeas(isRecord(parsed) ? parsed : null);
}
