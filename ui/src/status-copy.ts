import type { ReelStatus } from "./model";

export const REEL_STATUS_COPY: Record<
	ReelStatus,
	{ hint: string; label: string }
> = {
	draft: { hint: "Shape the cut and the caption.", label: "Draft" },
	idea: { hint: "A promising angle to explore.", label: "Idea" },
	published: {
		hint: "A manual local record; no platform delivery is connected.",
		label: "Marked published",
	},
	ready: {
		hint: "Reviewed and ready for your publishing workflow.",
		label: "Ready",
	},
	scheduled: {
		hint: "A planned local slot; no scheduler or platform delivery is connected.",
		label: "Planned slot",
	},
};
