interface RyuStorage {
	get(input: { namespace?: string; key: string }): Promise<string | null>;
	set(input: { namespace?: string; key: string; value: string }): Promise<void>;
}

interface RyuUpload {
	data_url: string;
	mime_type: string;
	name: string;
	size: number;
}

interface RyuModel {
	complete(input: {
		effort?: string;
		model?: string;
		prompt: string;
		provider?: string;
		system?: string;
	}): Promise<string>;
}

interface RyuUi {
	uploadFile(input?: {
		accept?: string;
		multiple?: boolean;
	}): Promise<RyuUpload | RyuUpload[] | null>;
}

interface RyuBridge {
	model?: RyuModel;
	storage?: RyuStorage;
	ui?: RyuUi;
}

declare global {
	interface Window {
		ryu?: RyuBridge;
	}
}

export {};
