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
import { useLiteralMessages } from "@ryu/i18n/react";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { useEffect, useMemo, useState } from "react";
import { ComposerDialog } from "./App-composer-dialog.tsx";
import {
	downloadJson,
	EMPTY_FORM,
	type Filter,
	type FormState,
	parseTags,
	rekeyImportedItems,
	toForm,
} from "./App-form.ts";
import { IdeaCard } from "./App-idea-card.tsx";
import {
	bridgeStatus,
	generateIdeas,
	loadState,
	pickTextFile,
	saveState,
} from "./bridge.ts";
import {
	makeReel,
	parseImportedReels,
	REEL_STATUSES,
	type ReelFarmAction,
	type ReelFarmState,
	type ReelItem,
	type ReelPatch,
	reduceReelFarmState,
	searchReels,
} from "./model.ts";
import { reelFilterSchema } from "./schemas.ts";
import { REEL_STATUS_COPY } from "./status-copy.ts";

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
	const tl = useLiteralMessages();

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
				tl(
					"Imported {count, plural, one {{countText} idea} other {{countText} ideas}}.",
					{ count: imported.length, countText: String(imported.length) }
				)
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
			setNotice(
				tl("{count} draft ideas added.", {
					count: String(generated.length),
				})
			);
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
		const result = { idea: 0, draft: 0, ready: 0, scheduled: 0, published: 0 };
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
					<span className={status.model ? "is-ready" : undefined} />
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
					onChange={(event) => {
						const filter = reelFilterSchema.safeParse(
							event.currentTarget.value
						);
						if (filter.success) {
							setFilter(filter.data);
						}
					}}
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
					{tl(
						"{count, plural, one {{countText} result} other {{countText} results}}",
						{ count: filtered.length, countText: String(filtered.length) }
					)}
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
