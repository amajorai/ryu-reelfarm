import type { HostServices } from "@ryu/app-host/rpc";
import type { z } from "zod";
import type { exportAttemptSchema } from "../src/schemas.ts";

export type ReelfarmFixtureInput =
	| Parameters<NonNullable<HostServices["storageGet"]>>[0]
	| Parameters<NonNullable<HostServices["storageSet"]>>[0]
	| NonNullable<Parameters<NonNullable<HostServices["uploadFile"]>>[0]>
	| Parameters<NonNullable<HostServices["modelComplete"]>>[0];

export interface FixtureCall {
	input: ReelfarmFixtureInput;
	method: string;
}

export type ExportAttempt = z.infer<typeof exportAttemptSchema>;

export interface ReelfarmFixture {
	calls: FixtureCall[];
	exports: ExportAttempt[];
	getStored(namespace: string, key: string): string | null;
}

export interface ReelfarmSnapshot {
	calls: FixtureCall[];
	exports: ExportAttempt[];
	stored: string | null;
}

declare global {
	interface Window {
		__reelfarmFixture?: ReelfarmFixture;
	}
}
