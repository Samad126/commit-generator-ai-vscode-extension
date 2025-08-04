# CommitGenAI

🤖 **Generate smart AI commit messages** based on your latest `git diff` directly inside Visual Studio Code!

## 🧠 What It Does

- Scans your current unstaged Git changes (`git diff`)
- Sends the diff to an AI-powered backend
- Generates a clean, readable commit message
- Lets you view it and copy it with one click

## 🖼️ Sidebar UI

This extension adds a new icon in the Activity Bar:

1. Click the **CommitGenAI** icon on the left.
2. Click **Generate** to create a commit message.
3. Click **Copy** to put it on your clipboard.

## 🚀 How to Use

1. Open any Git-enabled workspace in VS Code.
2. Make some changes (without committing).
3. Open the **CommitGenAI** view from the sidebar.
4. Click **Generate** → watch it think → copy the message!

## ⚙️ Requirements

- Git installed and initialized in your project
- Internet access (to reach the AI backend)

## 🧪 Features

- Git integration
- AI-generated commit messages
- Copy to clipboard
- VS Code theme integration
- Works in the sidebar (Activity Bar)

## 💻 Developer

Created by Samad Alakbarov. Backend is hosted on [Render](https://render.com).

## 📦 Extension Settings

No configuration needed.

## 📥 Installation

Install from VSIX:

```bash
code --install-extension commitgenai-vscode-extension-0.0.1.vsix
