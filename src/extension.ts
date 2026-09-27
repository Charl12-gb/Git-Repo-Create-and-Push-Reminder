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
	context.subscriptions.push(
		service,
		vscode.commands.registerCommand('git-push-reminder.checkNow', () => service.checkNow()),
	);
}

export function deactivate() {}
