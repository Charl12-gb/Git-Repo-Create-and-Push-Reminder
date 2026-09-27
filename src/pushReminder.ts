import { execFile } from 'node:child_process';
import * as vscode from 'vscode';

export interface GitRepository {
	readonly rootUri: vscode.Uri;
	readonly state: {
		onDidChange(listener: () => void): vscode.Disposable;
	};
}

export interface GitApi {
	readonly repositories: GitRepository[];
	onDidOpenRepository(listener: (repository: GitRepository) => void): vscode.Disposable;
	onDidCloseRepository(listener: (repository: GitRepository) => void): vscode.Disposable;
}

export interface GitExtension {
	getAPI(version: 1): GitApi;
}

interface RepositoryStatus {
	dirty: boolean;
	ahead: number;
	hasUpstream: boolean;
}

interface ReminderState {
	startedAt: number;
	dueAt: number;
	snoozes: number;
	lastMessage?: string;
}

const stateKey = 'repositoryReminders';
const snoozeOptions = [5, 10, 15, 20, 25, 30];

function runGit(repositoryPath: string, ...args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile('git', ['-C', repositoryPath, ...args], { encoding: 'utf8' }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(stderr.trim() || error.message));
				return;
			}
			resolve(stdout.trim());
		});
	});
}

export async function readStatus(repositoryPath: string): Promise<RepositoryStatus> {
	const porcelain = await runGit(repositoryPath, 'status', '--porcelain=v1');
	let hasUpstream = true;
	let ahead = 0;
	try {
		await runGit(repositoryPath, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
		ahead = Number(await runGit(repositoryPath, 'rev-list', '--count', '@{upstream}..HEAD')) || 0;
	} catch {
		hasUpstream = false;
		try {
			ahead = Number(await runGit(repositoryPath, 'rev-list', '--count', 'HEAD', '--not', '--remotes')) || 0;
		} catch {
			ahead = 0;
		}
	}
	return { dirty: porcelain.length > 0, ahead, hasUpstream };
}

export class PushReminderService implements vscode.Disposable {
	private readonly repositories = new Map<string, GitRepository>();
	private readonly repositoryListeners = new Map<string, vscode.Disposable>();
	private readonly states: Record<string, ReminderState>;
	private readonly repositoryLocks = new Set<string>();
	private processingDue = false;
	private disposed = false;
	private readonly timer: ReturnType<typeof setInterval>;
	private readonly gitListeners: vscode.Disposable[];

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly git: GitApi,
	) {
		this.states = context.workspaceState.get<Record<string, ReminderState>>(stateKey, {});
		this.gitListeners = [
			git.onDidOpenRepository((repository) => this.addRepository(repository)),
			git.onDidCloseRepository((repository) => this.removeRepository(repository)),
		];
		for (const repository of git.repositories) {
			this.addRepository(repository);
		}
		this.timer = setInterval(() => void this.checkNow(), 30_000);
		void this.checkNow();
	}

	async checkNow(): Promise<void> {
		if (this.disposed || !vscode.workspace.getConfiguration('gitPushReminder').get<boolean>('enabled', true)) {
			return;
		}
		await Promise.all([...this.repositories.entries()].map(([path]) => this.refreshRepository(path)));
		await this.processReminders();
	}

	dispose(): void {
		this.disposed = true;
		clearInterval(this.timer);
		for (const listener of [...this.gitListeners, ...this.repositoryListeners.values()]) {
			listener.dispose();
		}
	}

	private addRepository(repository: GitRepository): void {
		const path = repository.rootUri.fsPath;
		this.repositories.set(path, repository);
		this.repositoryListeners.get(path)?.dispose();
		this.repositoryListeners.set(path, repository.state.onDidChange(() => {
			void this.refreshRepository(path).then(() => this.processReminders());
		}));
		void this.refreshRepository(path).then(() => this.processReminders());
	}

	private removeRepository(repository: GitRepository): void {
		const path = repository.rootUri.fsPath;
		this.repositories.delete(path);
		this.repositoryListeners.get(path)?.dispose();
		this.repositoryListeners.delete(path);
	}

	private async refreshRepository(path: string): Promise<void> {
		if (this.repositoryLocks.has(path) || !this.repositories.has(path)) {
			return;
		}
		this.repositoryLocks.add(path);
		try {
			const status = await readStatus(path);
			if (!status.dirty && status.ahead === 0) {
				if (this.states[path]) {
					delete this.states[path];
					await this.persist();
				}
				return;
			}
			if (!this.states[path]) {
				const now = Date.now();
				const interval = vscode.workspace.getConfiguration('gitPushReminder').get<number>('intervalMinutes', 30);
				this.states[path] = { startedAt: now, dueAt: now + interval * 60_000, snoozes: 0 };
				await this.persist();
			}
		} catch (error) {
			console.error(`Git Push Reminder: impossible de lire ${path}`, error);
		} finally {
			this.repositoryLocks.delete(path);
		}
	}

	private async processReminders(): Promise<void> {
		if (this.processingDue || this.disposed) {
			return;
		}
		this.processingDue = true;
		try {
			const now = Date.now();
			const due = [...this.repositories.keys()].filter((path) => this.states[path]?.dueAt <= now);
			if (due.length === 0) {
				return;
			}
			const mode = vscode.workspace.getConfiguration('gitPushReminder').get<string>('commitMessageMode', 'perRepository');
			if (mode === 'shared') {
				await this.handleBatch(due, true);
			} else {
				for (const path of due) {
					await this.handleBatch([path], false);
				}
			}
		} finally {
			this.processingDue = false;
		}
	}

	private async handleBatch(paths: string[], useSharedMessage: boolean): Promise<void> {
		const statuses = await Promise.all(paths.map((path) => readStatus(path)));
		const forced = paths.some((path) => (this.states[path]?.snoozes ?? 0) >= 3);
		const labels = paths.map((path) => this.repositoryLabel(path));
		const title = paths.length === 1 ? labels[0] : `${paths.length} dépôts : ${labels.join(', ')}`;
		const hasLocalChanges = statuses.some((status) => status.dirty);
		const choice = forced ? 'Pousser maintenant' : 'Commit et push';
		const buttons = forced ? [choice] : [choice, 'Reporter'];
		const accepted = await vscode.window.showWarningMessage(
			`Des mises à jour locales ou commits en attente ont été détectés dans ${title}.${hasLocalChanges ? ' Tous les fichiers modifiés, indexés ou non, seront inclus dans le commit.' : ''}`,
			{ modal: true },
			...buttons,
		);
		if (accepted !== choice) {
			if (forced) {
				for (const path of paths) {
					const state = this.states[path];
					if (state) {
						state.dueAt = Date.now() + 60_000;
					}
				}
				await this.persist();
			} else if (accepted === 'Reporter') {
				await this.snooze(paths);
			}
			return;
		}

		const missingUpstream = paths.filter((_, index) => !statuses[index].hasUpstream);
		if (missingUpstream.length > 0) {
			void vscode.window.showErrorMessage(`Configure d’abord une branche distante (upstream) pour : ${missingUpstream.map((path) => this.repositoryLabel(path)).join(', ')}.`);
			await this.retryLater(paths);
			return;
		}

		const dirtyPaths = paths.filter((_, index) => statuses[index].dirty);
		let sharedMessage: string | undefined;
		if (dirtyPaths.length > 0 && useSharedMessage) {
			sharedMessage = await vscode.window.showInputBox({
				prompt: `Commentaire commun pour ${dirtyPaths.map((path) => this.repositoryLabel(path)).join(', ')}`,
				value: this.context.globalState.get<string>('sharedCommitMessage', ''),
				placeHolder: 'Ex. : Mise à jour de la fonctionnalité',
				ignoreFocusOut: true,
			});
			if (!sharedMessage?.trim()) {
				await this.retryLater(paths);
				return;
			}
		}

		try {
			for (const path of paths) {
				const index = paths.indexOf(path);
				if (statuses[index].dirty) {
					const message = sharedMessage ?? await this.getCommitMessage(path);
					if (!message) {
						await this.retryLater(paths);
						return;
					}
					await runGit(path, 'add', '-A');
					await runGit(path, 'commit', '-m', message);
					if (!sharedMessage) {
						this.states[path].lastMessage = message;
					}
				}
				await runGit(path, 'push');
				delete this.states[path];
				await this.persist();
			}
			if (sharedMessage) {
				await this.context.globalState.update('sharedCommitMessage', sharedMessage);
			}
			void vscode.window.showInformationMessage(`Push terminé pour ${title}.`);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(`Le push de ${title} a échoué : ${detail}`);
			await this.retryLater(paths);
		}
	}

	private async getCommitMessage(path: string): Promise<string | undefined> {
		const state = this.states[path];
		const value = await vscode.window.showInputBox({
			prompt: `Commentaire du commit pour ${this.repositoryLabel(path)}`,
			value: state?.lastMessage ?? '',
			placeHolder: 'Ex. : Mise à jour de la fonctionnalité',
			ignoreFocusOut: true,
		});
		return value?.trim() || undefined;
	}

	private async snooze(paths: string[]): Promise<void> {
		const options = snoozeOptions.map((minutes) => ({ label: `${minutes} minutes`, minutes }));
		const selected = await vscode.window.showQuickPick(options, {
			placeHolder: 'Reporter le rappel de combien de temps ?',
			ignoreFocusOut: true,
		});
		const minutes = selected?.minutes ?? 5;
		for (const path of paths) {
			const state = this.states[path];
			if (state) {
				state.snoozes += 1;
				state.dueAt = Date.now() + minutes * 60_000;
			}
		}
		await this.persist();
	}

	private async retryLater(paths: string[]): Promise<void> {
		for (const path of paths) {
			const state = this.states[path];
			if (state) {
				state.dueAt = Date.now() + 5 * 60_000;
			}
		}
		await this.persist();
	}

	private repositoryLabel(path: string): string {
		return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
	}

	private async persist(): Promise<void> {
		await this.context.workspaceState.update(stateKey, this.states);
	}
}