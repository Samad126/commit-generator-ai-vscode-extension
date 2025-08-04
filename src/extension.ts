import * as vscode from 'vscode';
import { exec } from 'child_process';

const BACKEND_URL =
  'https://commit-generator-ai-backend.onrender.com/generator/generate-commit-message';

export function activate(context: vscode.ExtensionContext) {
  console.log('✅ CommitGenAI extension activated');

  const disposable = vscode.commands.registerCommand(
    'commitgenai.openPanel',
    () => {
      // 1️⃣ Create the panel
      const panel = vscode.window.createWebviewPanel(
        'commitGenAI',
        'CommitGenAI',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );

      // 2️⃣ Set initial HTML
      panel.webview.html = getWebviewContent();

      // 3️⃣ Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case 'generate':
              // run git diff
              const folders = vscode.workspace.workspaceFolders;
              if (!folders) {
                panel.webview.postMessage({
                  command: 'error',
                  text: 'Open a workspace first.',
                });
                return;
              }
              exec(
                'git diff',
                { cwd: folders[0].uri.fsPath },
                async (err, stdout) => {
                  if (err) {
                    panel.webview.postMessage({
                      command: 'error',
                      text: `Git diff failed: ${err.message}`,
                    });
                    return;
                  }
                  if (!stdout.trim()) {
                    panel.webview.postMessage({
                      command: 'info',
                      text: 'No changes to diff.',
                    });
                    return;
                  }
                  try {
                    const fetch = (await import('node-fetch')).default;
                    const res = await fetch(BACKEND_URL, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        plainText: stdout,
                        isPair: false,
                      }),
                    });
                    if (!res.ok) {
                      const errText = await res.text();
                      panel.webview.postMessage({
                        command: 'error',
                        text: `Backend ${res.status}: ${res.statusText}\n${errText}`,
                      });
                      return;
                    }
                    const data = await res.json() as { aiResponse: string };
                    panel.webview.postMessage({
                      command: 'show',
                      text: data.aiResponse,
                    });
                  } catch (e) {
                    panel.webview.postMessage({
                      command: 'error',
                      text: `Network error: ${(e as Error).message}`,
                    });
                  }
                }
              );
              break;

            case 'copy':
              // copy to clipboard
              await vscode.env.clipboard.writeText(message.text);
              vscode.window.showInformationMessage(
                'Copied commit message!'
              );
              break;
          }
        },
        undefined,
        context.subscriptions
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  console.log('🛑 CommitGenAI deactivated');
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'unsafe-inline';" />
  <style>
    body { font-family: sans-serif; padding: 1rem; }
    button { margin: 0.5rem 0; padding: 0.5rem 1rem; }
    pre {
      background: #f3f3f3;
      padding: 1rem;
      border-radius: 4px;
      white-space: pre-wrap;
      max-height: 60vh;
      overflow: auto;
    }
    #copy { margin-left: 1rem; }
  </style>
</head>
<body>
  <h2>CommitGenAI</h2>
  <button id="generate">Generate Commit Message</button>
  <button id="copy" disabled>Copy to Clipboard</button>
  <div id="status" style="margin:0.5rem 0;color:#888;"></div>
  <pre id="commit"></pre>

  <script>
    const vscode = acquireVsCodeApi();
    const genBtn = document.getElementById('generate');
    const copyBtn = document.getElementById('copy');
    const commitEl = document.getElementById('commit');
    const statusEl = document.getElementById('status');

    genBtn.addEventListener('click', () => {
      commitEl.textContent = '';
      statusEl.textContent = 'Generating…';
      copyBtn.disabled = true;
      vscode.postMessage({ command: 'generate' });
    });

    copyBtn.addEventListener('click', () => {
      vscode.postMessage({
        command: 'copy',
        text: commitEl.textContent
      });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.command) {
        case 'show':
          commitEl.textContent = msg.text;
          statusEl.textContent = '';
          copyBtn.disabled = false;
          break;
        case 'info':
          statusEl.textContent = msg.text;
          break;
        case 'error':
          statusEl.textContent = 'Error: ' + msg.text;
          break;
      }
    });
  </script>
</body>
</html>`;
}
