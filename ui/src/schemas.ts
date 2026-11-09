import { appRequestValueSchema } from "@ryuhq/core-client/app-request-json";
import { z } from "zod";

export const reelPlatformSchema = z.enum([
	"Instagram",
	"TikTok",
	"YouTube Shorts",
	"LinkedIn",
]);
export const reelStatusSchema = z.enum([
	"idea",
	"draft",
	"ready",
	"scheduled",
	"published",
]);
export const reelFilterSchema = reelStatusSchema.or(
	z.enum(["all", "favorites"])
);
export const inputRecordSchema = z.record(z.string(), appRequestValueSchema);
export const inputArraySchema = z.array(appRequestValueSchema);

/** Storage is written by serializeState after the documented normalization. */
export const reelItemSchema = z.object({
	createdAt: z.number(),
	favorite: z.boolean(),
	hook: z.string(),
	id: z.string(),
	notes: z.string(),
	platform: reelPlatformSchema,
	scheduledFor: z.string().nullable(),
	status: reelStatusSchema,
	tags: z.array(z.string()),
	title: z.string(),
	updatedAt: z.number(),
});
export const reelFarmStateSchema = z.object({
	items: z.array(reelItemSchema),
	version: z.literal(1),
});

export const storageWriteSchema = z.object({
	key: z.string(),
	namespace: z.string().optional(),
	value: z.string(),
});
export const exportAttemptSchema = z.object({
	body: z.string(),
	filename: z.string(),
	href: z.string(),
});
export const exportMessageSchema = exportAttemptSchema.extend({
	type: z.literal("reelfarm-export-attempt"),
});
