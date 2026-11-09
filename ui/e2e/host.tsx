import { ExtensionHost } from "@ryu/app-host/ExtensionHost";
import { capabilitiesFromGrants, type HostServices } from "@ryu/app-host/rpc";
import { htmlCompanionSrcdoc } from "@ryu/app-host/third-party-plugin";
import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../../../../packages/i18n/src/react.tsx";
import manifest from "../../manifest.json" with { type: "json" };
import appHtml from "../dist/index.html?raw";
import { exportMessageSchema } from "../src/schemas.ts";
import type {
	ExportAttempt,
	FixtureCall,
	ReelfarmFixture,
	ReelfarmFixtureInput,
} from "./fixture-types.ts";
import styles from "./host.module.css";
import "./host.css";

const STORAGE_PREFIX = "reelfarm-proof:";
const storageKey = (namespace: string | undefined, key: string) =>
	`${namespace ?? "default"}/${key}`;
const storageValues = new Map<string, string>();
const fixtureCalls: FixtureCall[] = [];
const exportAttempts: ExportAttempt[] = [];
const callsByMethod = new Map<string, number>();

for (let index = 0; index < localStorage.length; index += 1) {
	const name = localStorage.key(index);
	if (name?.startsWith(STORAGE_PREFIX)) {
		const value = localStorage.getItem(name);
		if (value !== null) {
			storageValues.set(name.slice(STORAGE_PREFIX.length), value);
		}
	}
}

function recordCall(method: string, input: ReelfarmFixtureInput): number {
	fixtureCalls.push({ input, method });
	const count = (callsByMethod.get(method) ?? 0) + 1;
	callsByMethod.set(method, count);
	return count;
}

function encodeFile(raw: string) {
	return {
		data_url: `data:application/json;base64,${btoa(raw)}`,
		id: "reelfarm-fixture-file",
		space_id: "reelfarm-fixture-space",
		url: "https://reelfarm.fixture/api/uploads/reelfarm-fixture-file",
		mime_type: "application/json",
		name: "studio-ideas.json",
		size: raw.length,
	};
}

const services: HostServices = {
	listAgents: async () => [],
	registerRoute: () =>
		Promise.reject(
			new Error("This Reelfarm fixture does not register routes.")
		),
	storageGet: async (input) => {
		recordCall("storage.get", input);
		return storageValues.get(storageKey(input.namespace, input.key)) ?? null;
	},
	storageSet: async (input) => {
		recordCall("storage.set", input);
		const name = storageKey(input.namespace, input.key);
		storageValues.set(name, input.value);
		localStorage.setItem(`${STORAGE_PREFIX}${name}`, input.value);
	},
	uploadFile: async (input) => {
		const callNumber = recordCall("ui.uploadFile", input ?? {});
		const raw =
			callNumber === 1
				? "this is not JSON"
				: JSON.stringify({
						slides: [
							{
								body: "Show the before and after.",
								headline: "Name the outcome first.",
								title: "A stronger opening frame",
							},
						],
					});
		return encodeFile(raw);
	},
	modelComplete: async (input) => {
		const callNumber = recordCall("model.complete", input);
		if (callNumber === 1) {
			throw new Error("The local model fixture is temporarily unavailable.");
		}
		return JSON.stringify({
			ideas: [
				{
					hook: "Start with the next owner.",
					notes: "Show the handoff before and after.",
					tags: ["handoff", "workflow"],
					title: "A clearer handoff",
				},
				{
					hook: "One small setup prevents a long detour.",
					notes: "Walk through the first minute.",
					tags: ["setup"],
					title: "The one-minute setup",
				},
				{
					hook: "Show the decision before the diagram.",
					notes: "Use one concrete example.",
					tags: ["explainer"],
					title: "A decision-first explainer",
				},
			],
		});
	},
};

const fixture: ReelfarmFixture = {
	calls: fixtureCalls,
	exports: exportAttempts,
	getStored: (namespace, key) =>
		storageValues.get(storageKey(namespace, key)) ?? null,
};
Object.assign(window, { __reelfarmFixture: fixture });

window.addEventListener("message", (event) => {
	const iframe = document.querySelector("iframe");
	if (event.source !== iframe?.contentWindow) {
		return;
	}
	const message = exportMessageSchema.safeParse(event.data);
	if (message.success) {
		exportAttempts.push({
			body: message.data.body,
			filename: message.data.filename,
			href: message.data.href,
		});
	}
});

function ProductHost() {
	const nonce = useMemo(() => crypto.randomUUID(), []);
	const srcdoc = useMemo(
		() => htmlCompanionSrcdoc(nonce, appHtml, manifest.id),
		[nonce]
	);
	return (
		<div className={styles.proofHost}>
			<p className={styles.proofBanner}>
				Rendered product test · deterministic local storage, upload, and model
				fixtures · no social publisher or scheduler
			</p>
			<ExtensionHost
				allowForms
				granted={capabilitiesFromGrants(manifest.permission_grants)}
				nonce={nonce}
				services={services}
				srcdoc={srcdoc}
				title="Studio"
			/>
		</div>
	);
}

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<I18nProvider>
			<ProductHost />
		</I18nProvider>
	);
}
