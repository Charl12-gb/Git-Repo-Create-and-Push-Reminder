import * as vscode from 'vscode';
import { PushReminderService, type GitApi, type GitExtension } from './pushReminder';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
	if (!gitExtension) {
		void vscode.window.showErrorMessage('Git Push Reminder nécessite l’extension Git intégrée à VS Code.');
		return;
	}

	const gitExports = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
	const service = new PushReminderService(context, gitExports.getAPI(1));
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'git-push-reminder.changeInterval';
	statusBarItem.tooltip = 'Cliquer pour modifier la fréquence des rappels Git';

	const updateStatusBar = (): void => {
		const interval = vscode.workspace.getConfiguration('gitPushReminder').get<number>('intervalMinutes', 30);
		statusBarItem.text = `$(git-commit) Push : ${interval} min`;
		statusBarItem.show();
	};

	updateStatusBar();
	context.subscriptions.push(
		service,
		statusBarItem,
		vscode.commands.registerCommand('git-push-reminder.checkNow', () => service.checkNow()),
		vscode.commands.registerCommand('git-push-reminder.changeInterval', async () => {
			const configuration = vscode.workspace.getConfiguration('gitPushReminder');
			const current = configuration.get<number>('intervalMinutes', 30);
			const value = await vscode.window.showInputBox({
				title: 'Fréquence des rappels Git',
				prompt: 'Saisis un intervalle en minutes (de 1 à 1 440).',
				value: String(current),
				placeHolder: '30',
				validateInput: (input) => {
					const minutes = Number(input);
					return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440
						? undefined
						: 'Saisis un nombre entier entre 1 et 1 440.';
				},
			});
			if (value === undefined) {
				return;
			}
			await configuration.update('intervalMinutes', Number(value), vscode.ConfigurationTarget.Workspace);
			updateStatusBar();
		}),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('gitPushReminder.intervalMinutes')) {
				updateStatusBar();
			}
		}),
	);
}

export function deactivate() {}
