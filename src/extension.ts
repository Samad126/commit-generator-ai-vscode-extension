import * as vscode from 'vscode';
import { exec } from 'child_process';

const BACKEND_URL =
  'https://commit-generator-ai-backend.onrender.com/generator/generate-commit-message';

export function activate(context: vscode.ExtensionContext) {
  // Register our WebviewViewProvider under the view ID
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'commitGenAI.view',
      new CommitGenAIViewProvider(context.extensionUri, context)
    )
  );
}

export function deactivate() {
  /* nothing to clean up */
}

class CommitGenAIViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the sidebar UI
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'generate':
            await this.generateCommit();
            break;
          case 'copy':
            await vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage(
              'Copied commit message!'
            );
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /** Run `git diff`, send to backend, and post result back into the webview. */
  private generateCommit() {
    if (!this._view) {
      return;
    }
    const webview = this._view.webview;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      webview.postMessage({ command: 'error', text: 'Open a workspace first.' });
      return;
    }

    exec('git diff', { cwd: folders[0].uri.fsPath }, async (err, stdout) => {
      if (err) {
        webview.postMessage({ command: 'error', text: `Git diff failed: ${err.message}` });
        return;
      }
      if (!stdout.trim()) {
        webview.postMessage({ command: 'info', text: 'No changes to diff.' });
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
          webview.postMessage({
            command: 'error',
            text: `Backend ${res.status}: ${res.statusText}\n${errText}`
          });
          return;
        }

        const data = await res.json() as {aiResponse : string};
        webview.postMessage({ command: 'show', text: data.aiResponse });
      } catch (e) {
        webview.postMessage({
          command: 'error',
          text: `Network error: ${(e as Error).message}`
        });
      }
    });
  }

  /** Returns the HTML of the sidebar, with Generate & Copy buttons. */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'unsafe-inline';" />
  <style>
    body { font-family: sans-serif; padding: 1rem; }
    button { margin: 0.5rem 0; padding: 0.4rem 0.8rem; }
    #copy { margin-left: 1rem; }
    #status { color: #888; margin: 0.5rem 0; }
    pre {
      background: #f3f3f3;
      padding: 1rem;
      border-radius: 4px;
      white-space: pre-wrap;
      max-height: calc(100vh - 200px);
      overflow: auto;
    }
  </style>
</head>
<body>
  <button id="generate">Generate Commit Message</button>
  <button id="copy" disabled>Copy to Clipboard</button>
  <div id="status"></div>
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
}
