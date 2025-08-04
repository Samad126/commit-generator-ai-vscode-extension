import * as vscode from 'vscode';
import { exec } from 'child_process';

const BACKEND_URL = 'https://commit-generator-ai-backend.onrender.com/generator/generate-commit-message';

export function activate(context: vscode.ExtensionContext) {
	console.log('✅ CommitGenAI extension activated');

	const disposable = vscode.commands.registerCommand(
		'commitgenai.sendGitDiff',
		async () => {
			const folders = vscode.workspace.workspaceFolders;
			if (!folders) {
				vscode.window.showErrorMessage('Open a workspace first.');
				return;
			}
			const repoPath = folders[0].uri.fsPath;

			exec('git diff', { cwd: repoPath }, async (err, stdout) => {
				if (err) {
					vscode.window.showErrorMessage(`Git diff failed: ${err.message}`);
					return;
				}
				if (!stdout.trim()) {
					vscode.window.showInformationMessage('No changes to diff.');
					return;
				}

				try {
					const fetch = (await import('node-fetch')).default;
					const res = await fetch(BACKEND_URL, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ plainText: stdout, isPair: false })
					});

					const data = await res.json();
					
					if (res.ok) {
						// vscode.window.showInformationMessage('Git diff sent!');
						vscode.window.showInformationMessage(JSON.stringify(data));
					} else {
						const errText = await res.text();
						vscode.window.showErrorMessage(
							`Backend ${res.status}: ${res.statusText}\n${errText}`
						);
					}
				} catch (e) {
					vscode.window.showErrorMessage(
						`Network error: ${(e as Error).message}`
					);
				}
			});
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() {
	console.log('🛑 CommitGenAI extension deactivated');
}
