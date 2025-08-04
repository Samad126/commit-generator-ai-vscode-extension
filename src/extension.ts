import * as vscode from 'vscode';
import { exec } from 'child_process';

const BACKEND_URL =
  'https://commit-generator-ai-backend.onrender.com/generator/generate-commit-message';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'commitGenAI.view',
      new CommitGenAIViewProvider(context.extensionUri, context)
    )
  );
}

export function deactivate() { }

class CommitGenAIViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) { }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (msg) => {
        if (!this._view) { return; }
        const w = this._view.webview;

        switch (msg.command) {
          case 'generate':
            {
              const folders = vscode.workspace.workspaceFolders;
              if (!folders) {
                w.postMessage({ command: 'error', text: 'Please open a workspace first.' });
                return;
              }
              // show loading in the webview
              w.postMessage({ command: 'loading' });

              exec('git diff', { cwd: folders[0].uri.fsPath }, async (err, stdout) => {
                if (err) {
                  w.postMessage({ command: 'error', text: `Git diff failed: ${err.message}` });
                  return;
                }
                if (!stdout.trim()) {
                  w.postMessage({ command: 'info', text: 'No unstaged changes detected.' });
                  return;
                }

                try {
                  const fetch = (await import('node-fetch')).default;
                  const res = await fetch(BACKEND_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plainText: stdout, isPair: false })
                  });

                  if (!res.ok) {
                    const errText = await res.text();
                    w.postMessage({
                      command: 'error',
                      text: `Backend ${res.status}: ${res.statusText}\n${errText}`
                    });
                    return;
                  }

                  const data = await res.json() as { aiResponse: string };
                  w.postMessage({ command: 'show', text: data.aiResponse });

                } catch (e) {
                  w.postMessage({
                    command: 'error',
                    text: `Network error: ${(e as Error).message}`
                  });
                }
              });
            }
            break;

          case 'copy':
            await vscode.env.clipboard.writeText(msg.text);
            vscode.window.showInformationMessage('Commit message copied!');
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private getHtml(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <style>
    :root {
      --bg: var(--vscode-sideBar-background);
      --fg: var(--vscode-sideBar-foreground);
      --card: var(--vscode-editor-background);
      --border: var(--vscode-editorWidget-border);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
    }
    body {
      margin: 0; padding: 1rem;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .header { text-align: center; }
    .header h2 { margin: 0; }
    .header p { margin: 0; font-size: 0.9em; opacity: 0.8; }
    .controls { display: flex; gap: 0.5rem; }
    button {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: 4px;
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: var(--vscode-font-size);
    }
    button:hover { background: var(--btn-hover); }
    button:disabled { opacity: 0.5; cursor: default; }
    #status {
      font-size: 0.85em; opacity: 0.7; min-height: 1.2em;
    }
    pre {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.8rem;
      white-space: pre-wrap;
      max-height: calc(60vh);
      overflow: auto;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>🤖 CommitGenAI</h2>
      <p>Generate AI-powered commit messages from your latest diff</p>
    </div>
    <div class="controls">
      <button id="generate">Generate</button>
      <button id="copy" disabled>Copy</button>
    </div>
    <div id="status">Click “Generate” to start</div>
    <pre id="commit">Your commit message will appear here…</pre>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const genBtn = document.getElementById('generate');
    const copyBtn = document.getElementById('copy');
    const statusEl = document.getElementById('status');
    const commitEl = document.getElementById('commit');

    // When clicked, show loading immediately and send request
    genBtn.addEventListener('click', () => {
      statusEl.textContent = 'Generating… ⏳';
      commitEl.textContent = '';
      copyBtn.disabled = true;
      vscode.postMessage({ command: 'generate' });
    });

    // Copy the shown text
    copyBtn.addEventListener('click', () => {
      vscode.postMessage({
        command: 'copy',
        text: commitEl.textContent
      });
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'show') {
        statusEl.textContent = 'Done! 🎉';
        commitEl.textContent = msg.text;
        copyBtn.disabled = false;
      } else if (msg.command === 'info') {
        statusEl.textContent = msg.text;
      } else if (msg.command === 'error') {
        statusEl.textContent = '❗ ' + msg.text;
      } else if (msg.command === 'loading') {
        // we already set loading in click handler, but you can handle it here too
      }
    });
  </script>
</body>
</html>`;
  }
}
