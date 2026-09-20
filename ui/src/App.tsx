import {
	RyuAppEmpty,
	RyuAppMain,
	RyuAppToolbar,
} from "@ryu/blocks/companion/app-ui";
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
import { Card } from "@ryu/ui/components/card.tsx";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { useEffect, useMemo, useState } from "react";
import {
	bridgeStatus,
	generateIdeas,
	loadState,
	pickTextFile,
	saveState,
} from "./bridge";
import {
	makeReel,
	parseImportedReels,
	REEL_PLATFORMS,
	REEL_STATUSES,
	type ReelFarmAction,
	type ReelFarmState,
	type ReelItem,
	type ReelPatch,
	type ReelPlatform,
	type ReelStatus,
	reduceReelFarmState,
	searchReels,
	serializeState,
} from "./model";
import { REEL_STATUS_COPY } from "./status-copy";

type Filter = "all" | "favorites" | ReelStatus;

interface FormState {
	hook: string;
	notes: string;
	platform: ReelPlatform;
	scheduledFor: string;
	tags: string;
	title: string;
}

const EMPTY_FORM: FormState = {
	hook: "",
	notes: "",
	platform: "Instagram",
	scheduledFor: "",
	tags: "",
	title: "",
};

function toForm(item: ReelItem): FormState {
	return {
		hook: item.hook,
		notes: item.notes,
		platform: item.platform,
		scheduledFor: item.scheduledFor ?? "",
		tags: item.tags.join(", "),
		title: item.title,
	};
}

function parseTags(value: string): string[] {
	return value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean)
		.slice(0, 12);
}

function rekeyImportedItems(
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

function downloadJson(state: ReelFarmState): void {
	const blob = new Blob([serializeState(state)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.download = `${safeFileName("studio")}.json`;
	anchor.href = url;
	anchor.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

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

function IdeaCard({
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
	const schedule = formatSchedule(item.scheduledFor);
	return (
		<Card className="reelfarm-card">
			<div className="reelfarm-card-topline">
				<span className="reelfarm-platform">{item.platform}</span>
				<Button
					aria-label={`${item.favorite ? "Remove" : "Add"} ${item.title} favorite`}
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
					aria-label={`Move ${item.title}`}
					className="reelfarm-status-select"
					onChange={(event) =>
						onStatus(item.id, event.currentTarget.value as ReelStatus)
					}
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
		</Card>
	);
}

function ComposerDialog({
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
								onChange={(event) =>
									onChange({
										platform: event.currentTarget.value as ReelPlatform,
									})
								}
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

export default function App() {
	const [state, setState] = useState<ReelFarmState>(() => ({
		items: [],
		version: 1,
	}));
	const [loaded, setLoaded] = useState(false);
	const [mode, setMode] = useState<"demo" | "live">("demo");
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [composerOpen, setComposerOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	const [brief, setBrief] = useState(
		"A repeatable way for a small team to publish useful short-form ideas"
	);
	const [busy, setBusy] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const status = useMemo(() => bridgeStatus(), []);

	useEffect(() => {
		let cancelled = false;
		loadState()
			.then((result) => {
				if (cancelled) {
					return;
				}
				setMode(result.mode);
				setState(result.state);
				setLoaded(true);
			})
			.catch((error) => {
				if (!cancelled) {
					setNotice(
						error instanceof Error
							? error.message
							: "Studio storage could not be loaded."
					);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!loaded) {
			return;
		}
		const timer = window.setTimeout(() => {
			void saveState(state).catch(() =>
				setNotice("The local save could not be completed.")
			);
		}, 350);
		return () => window.clearTimeout(timer);
	}, [loaded, state]);

	function dispatch(action: ReelFarmAction) {
		setState((current) => reduceReelFarmState(current, action));
	}

	function openNew() {
		setEditingId(null);
		setForm(EMPTY_FORM);
		setComposerOpen(true);
	}

	function openEdit(item: ReelItem) {
		setEditingId(item.id);
		setForm(toForm(item));
		setComposerOpen(true);
	}

	function saveForm() {
		const title = form.title.trim();
		if (!title) {
			setNotice("Give the idea a title before saving.");
			return;
		}
		const patch: ReelPatch = {
			hook: form.hook,
			notes: form.notes,
			platform: form.platform,
			scheduledFor: form.scheduledFor || null,
			tags: parseTags(form.tags),
			title,
		};
		if (editingId) {
			dispatch({ id: editingId, patch, type: "update" });
			setNotice("Idea updated.");
		} else {
			dispatch({ item: makeReel(title, patch), type: "add" });
			setNotice("Idea added to the farm.");
		}
		setComposerOpen(false);
	}

	async function importIdeas() {
		try {
			const raw = await pickTextFile();
			if (!raw) {
				return;
			}
			const imported = rekeyImportedItems(
				parseImportedReels(raw),
				new Set(state.items.map((item) => item.id))
			);
			setState((current) => ({
				...current,
				items: [...imported, ...current.items].slice(0, 200),
			}));
			setNotice(
				`Imported ${imported.length} idea${imported.length === 1 ? "" : "s"}.`
			);
		} catch (error) {
			setNotice(
				error instanceof Error
					? error.message
					: "The ideas could not be imported."
			);
		}
	}

	async function generateBatch() {
		setBusy("Drafting ideas…");
		try {
			const generated = await generateIdeas(brief, 3);
			if (generated.length === 0) {
				throw new Error("The model returned no usable ideas.");
			}
			setState((current) => ({
				...current,
				items: [
					...generated.map((idea) =>
						makeReel(idea.title, {
							hook: idea.hook,
							notes: idea.notes,
							tags: idea.tags,
							status: "idea",
						})
					),
					...current.items,
				].slice(0, 200),
			}));
			setNotice(`${generated.length} draft ideas added.`);
		} catch (error) {
			setNotice(
				error instanceof Error ? error.message : "Idea generation failed."
			);
		} finally {
			setBusy(null);
		}
	}

	const filtered = useMemo(() => {
		const searched = searchReels(state.items, query);
		return searched.filter((item) => {
			if (filter === "favorites") {
				return item.favorite;
			}
			return filter === "all" || item.status === filter;
		});
	}, [filter, query, state.items]);

	const counts = useMemo(() => {
		const result = {} as Record<ReelStatus, number>;
		for (const statusValue of REEL_STATUSES) {
			result[statusValue] = state.items.filter(
				(item) => item.status === statusValue
			).length;
		}
		return result;
	}, [state.items]);

	const columns = REEL_STATUSES.map((statusValue) => ({
		items: filtered.filter((item) => item.status === statusValue),
		status: statusValue,
	}));

	if (!loaded) {
		return notice ? (
			<RyuAppEmpty description={notice} title="Studio is unavailable" />
		) : (
			<div className="reelfarm-loading">Opening Studio…</div>
		);
	}

	return (
		<RyuAppMain className="reelfarm-main">
			<RyuAppToolbar
				actions={
					<div className="reelfarm-toolbar-actions">
						<Button
							onClick={() => void importIdeas()}
							type="button"
							variant="ghost"
						>
							Import JSON
						</Button>
						<Button
							onClick={() => downloadJson(state)}
							type="button"
							variant="secondary"
						>
							Export JSON
						</Button>
						<Button onClick={openNew} type="button" variant="default">
							New idea <span aria-hidden="true">↗</span>
						</Button>
					</div>
				}
				className="reelfarm-toolbar"
				title="Studio"
			>
				<span className="reelfarm-mode">
					{mode === "live" ? "Node library" : "Browser preview"}
				</span>
			</RyuAppToolbar>

			<section className="reelfarm-summary">
				<div>
					<h1>Content queue</h1>
					<p>Review hooks, drafts, and local publish plans in one place.</p>
					<p
						className="reelfarm-boundary"
						data-testid="reelfarm-local-boundary"
					>
						Local planning only · no social platform publishing or scheduler is
						connected.
					</p>
				</div>
				<div className="reelfarm-capability">
					<span className={status.model ? "is-ready" : "is-muted"} />
					<div>
						<strong>
							{busy ?? (status.model ? "Model ready" : "Local planning mode")}
						</strong>
						<small>
							{status.storage
								? "Saved to this node"
								: mode === "demo"
									? "Browser preview · local save when available"
									: "Storage bridge unavailable"}
						</small>
					</div>
				</div>
			</section>

			<section aria-label="Farm summary" className="reelfarm-stats">
				<div>
					<strong>{state.items.length}</strong>
					<span>Total ideas</span>
				</div>
				<div>
					<strong>{counts.ready}</strong>
					<span>Ready for review</span>
				</div>
				<div>
					<strong>{counts.scheduled}</strong>
					<span>Planned slots</span>
				</div>
				<div>
					<strong>{state.items.filter((item) => item.favorite).length}</strong>
					<span>Favorites</span>
				</div>
			</section>

			<section aria-label="Draft ideas with Ryu" className="reelfarm-generator">
				<div>
					<h2>Start with a brief.</h2>
					<p>
						Generate a few hooks and visual directions, then edit them like any
						other idea.
					</p>
				</div>
				<div className="reelfarm-generator-form">
					<Textarea
						aria-label="Generation brief"
						onChange={(event) => setBrief(event.currentTarget.value)}
						rows={2}
						value={brief}
					/>
					<Button
						disabled={!status.model || busy !== null}
						onClick={() => void generateBatch()}
						type="button"
						variant="default"
					>
						{busy ?? "Draft 3 ideas"}
					</Button>
				</div>
			</section>

			<section aria-label="Idea filters" className="reelfarm-controls">
				<Input
					aria-label="Search ideas, hooks, and notes"
					onChange={(event) => setQuery(event.currentTarget.value)}
					placeholder="Search ideas, hooks, and notes"
					value={query}
				/>
				<NativeSelect
					aria-label="Filter ideas"
					onChange={(event) => setFilter(event.currentTarget.value as Filter)}
					value={filter}
				>
					<NativeSelectOption value="all">All stages</NativeSelectOption>
					<NativeSelectOption value="favorites">Favorites</NativeSelectOption>
					{REEL_STATUSES.map((statusValue) => (
						<NativeSelectOption key={statusValue} value={statusValue}>
							{REEL_STATUS_COPY[statusValue].label}
						</NativeSelectOption>
					))}
				</NativeSelect>
				<span className="reelfarm-results-count">
					{filtered.length} result{filtered.length === 1 ? "" : "s"}
				</span>
			</section>

			{state.items.length === 0 ? (
				<RyuAppEmpty
					actions={
						<Button onClick={openNew} type="button">
							Add your first idea
						</Button>
					}
					description="Ideas, hooks, and publish slots will stay in this app's local library."
					title="Your farm is quiet"
				/>
			) : filtered.length === 0 ? (
				<div className="reelfarm-filter-empty">
					<h2>No ideas match this view.</h2>
					<p>Try another stage or a broader search.</p>
				</div>
			) : (
				<section aria-label="Publishing stages" className="reelfarm-board">
					{columns.map(({ items, status: statusValue }) => (
						<section className="reelfarm-column" key={statusValue}>
							<header>
								<div>
									<h2>{REEL_STATUS_COPY[statusValue].label}</h2>
									<p>{REEL_STATUS_COPY[statusValue].hint}</p>
								</div>
								<span>{items.length}</span>
							</header>
							<div className="reelfarm-column-items">
								{items.map((item) => (
									<IdeaCard
										item={item}
										key={item.id}
										onDelete={setPendingDeleteId}
										onEdit={openEdit}
										onFavorite={(id) =>
											dispatch({ id, type: "toggle-favorite" })
										}
										onStatus={(id, nextStatus) =>
											dispatch({ id, status: nextStatus, type: "set-status" })
										}
									/>
								))}
							</div>
						</section>
					))}
				</section>
			)}

			{notice ? (
				<Button
					aria-label="Dismiss notice"
					className="reelfarm-notice"
					onClick={() => setNotice(null)}
					type="button"
					variant="secondary"
				>
					{notice}
				</Button>
			) : null}

			<ComposerDialog
				editing={editingId !== null}
				form={form}
				onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
				onClose={() => setComposerOpen(false)}
				onSubmit={saveForm}
				open={composerOpen}
			/>

			<Dialog
				onOpenChange={(next) => {
					if (!next) {
						setPendingDeleteId(null);
					}
				}}
				open={pendingDeleteId !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this idea?</DialogTitle>
						<DialogDescription>
							This removes it from the local publishing queue.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => setPendingDeleteId(null)}
							type="button"
							variant="ghost"
						>
							Keep idea
						</Button>
						<Button
							onClick={() => {
								if (pendingDeleteId) {
									dispatch({ id: pendingDeleteId, type: "delete" });
								}
								setPendingDeleteId(null);
								setNotice("Idea deleted.");
							}}
							type="button"
							variant="destructive"
						>
							Delete idea
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</RyuAppMain>
	);
}
