import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Textarea,
} from "@ryu/blocks/companion/controls";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import type { FormState } from "./App-form.ts";
import { REEL_PLATFORMS } from "./model.ts";
import { reelPlatformSchema } from "./schemas.ts";

export function ComposerDialog({
	form,
	onChange,
	onClose,
	onSubmit,
	open,
	editing,
}: {
	form: FormState;
	onChange: (patch: Partial<FormState>) => void;
	onClose: () => void;
	onSubmit: () => void;
	open: boolean;
	editing: boolean;
}) {
	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
			open={open}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{editing ? "Edit idea" : "New idea"}</DialogTitle>
					<DialogDescription>
						Keep the promise, the visual, and the next action in one place.
					</DialogDescription>
				</DialogHeader>
				<form
					className="reelfarm-form"
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit();
					}}
				>
					<label className="reelfarm-field">
						<span>Title</span>
						<Input
							autoFocus
							onChange={(event) =>
								onChange({ title: event.currentTarget.value })
							}
							placeholder="A specific idea"
							value={form.title}
						/>
					</label>
					<label className="reelfarm-field">
						<span>Hook</span>
						<Textarea
							onChange={(event) =>
								onChange({ hook: event.currentTarget.value })
							}
							placeholder="The first line someone should hear"
							rows={2}
							value={form.hook}
						/>
					</label>
					<div className="reelfarm-field-grid">
						<label className="reelfarm-field">
							<span>Platform</span>
							<NativeSelect
								aria-label="Platform"
								onChange={(event) => {
									const platform = reelPlatformSchema.safeParse(
										event.currentTarget.value
									);
									if (platform.success) {
										onChange({ platform: platform.data });
									}
								}}
								value={form.platform}
							>
								{REEL_PLATFORMS.map((platform) => (
									<NativeSelectOption key={platform} value={platform}>
										{platform}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</label>
						<label className="reelfarm-field">
							<span>Publish slot</span>
							<Input
								onChange={(event) =>
									onChange({ scheduledFor: event.currentTarget.value })
								}
								type="datetime-local"
								value={form.scheduledFor}
							/>
						</label>
					</div>
					<label className="reelfarm-field">
						<span>Tags</span>
						<Input
							onChange={(event) =>
								onChange({ tags: event.currentTarget.value })
							}
							placeholder="hooks, workflow"
							value={form.tags}
						/>
					</label>
					<label className="reelfarm-field">
						<span>Notes</span>
						<Textarea
							onChange={(event) =>
								onChange({ notes: event.currentTarget.value })
							}
							placeholder="Visual direction or supporting context"
							rows={3}
							value={form.notes}
						/>
					</label>
					<DialogFooter>
						<Button onClick={onClose} type="button" variant="ghost">
							Cancel
						</Button>
						<Button type="submit" variant="default">
							{editing ? "Save changes" : "Add to farm"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
