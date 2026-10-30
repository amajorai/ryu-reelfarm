import { Button } from "@ryu/blocks/companion/controls";
import { useLiteralMessages } from "@ryu/i18n/react";
import { Card, CardContent } from "@ryu/ui/components/card.tsx";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { REEL_STATUSES, type ReelItem, type ReelStatus } from "./model.ts";
import { reelStatusSchema } from "./schemas.ts";
import { REEL_STATUS_COPY } from "./status-copy.ts";

function formatSchedule(value: string | null): string | null {
	if (!value) {
		return null;
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
	}).format(date);
}

function statusOptions(current: ReelStatus): ReelStatus[] {
	return REEL_STATUSES.filter((status) => status !== current);
}

export function IdeaCard({
	item,
	onDelete,
	onEdit,
	onFavorite,
	onStatus,
}: {
	item: ReelItem;
	onDelete: (id: string) => void;
	onEdit: (item: ReelItem) => void;
	onFavorite: (id: string) => void;
	onStatus: (id: string, status: ReelStatus) => void;
}) {
	const tl = useLiteralMessages();
	const schedule = formatSchedule(item.scheduledFor);
	return (
		<Card size="sm">
			<CardContent>
				<div className="reelfarm-card">
					<div className="reelfarm-card-topline">
						<span className="reelfarm-platform">{item.platform}</span>
						<Button
							aria-label={
								item.favorite
									? tl("Remove {title} favorite", { title: item.title })
									: tl("Add {title} favorite", { title: item.title })
							}
							aria-pressed={item.favorite}
							onClick={() => onFavorite(item.id)}
							size="icon-xs"
							type="button"
							variant="ghost"
						>
							{item.favorite ? "★" : "☆"}
						</Button>
					</div>
					<h3>{item.title}</h3>
					<p className="reelfarm-hook">{item.hook}</p>
					{item.notes ? <p className="reelfarm-notes">{item.notes}</p> : null}
					{item.tags.length > 0 ? (
						<div aria-label="Tags" className="reelfarm-tags">
							{item.tags.map((tag) => (
								<span key={tag}>#{tag}</span>
							))}
						</div>
					) : null}
					<div className="reelfarm-card-footer">
						{schedule ? (
							<span className="reelfarm-schedule">{schedule}</span>
						) : (
							<span />
						)}
						<NativeSelect
							aria-label={tl("Move {title}", { title: item.title })}
							className="max-w-28"
							onChange={(event) => {
								const status = reelStatusSchema.safeParse(
									event.currentTarget.value
								);
								if (status.success) {
									onStatus(item.id, status.data);
								}
							}}
							value={item.status}
						>
							<NativeSelectOption value={item.status}>
								{REEL_STATUS_COPY[item.status].label}
							</NativeSelectOption>
							{statusOptions(item.status).map((status) => (
								<NativeSelectOption key={status} value={status}>
									{REEL_STATUS_COPY[status].label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>
					<div className="reelfarm-card-actions">
						<Button
							onClick={() => onEdit(item)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Edit
						</Button>
						<Button
							onClick={() => onDelete(item.id)}
							size="sm"
							type="button"
							variant="ghost"
						>
							Delete
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
