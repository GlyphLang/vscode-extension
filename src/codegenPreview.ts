import * as vscode from 'vscode';

export class CodegenPreviewPanel {
    public static currentPanel: CodegenPreviewPanel | undefined;
    private static readonly viewType = 'glyphCodegenPreview';

    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private fileName: string,
        private pythonCode: string,
        private typescriptCode: string
    ) {
        this.panel = panel;
        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === 'save') {
                    const lang = message.language as string;
                    const code = lang === 'python' ? this.pythonCode : this.typescriptCode;
                    const ext = lang === 'python' ? 'py' : 'ts';
                    const defaultName = lang === 'python' ? 'main.py' : 'app.ts';

                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(defaultName),
                        filters: { [lang]: [ext] }
                    });

                    if (uri) {
                        await vscode.workspace.fs.writeFile(uri, Buffer.from(code, 'utf-8'));
                        vscode.window.showInformationMessage(`Saved ${lang} code to ${uri.fsPath}`);
                    }
                }
            },
            null,
            this.disposables
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        fileName: string,
        pythonCode: string,
        typescriptCode: string
    ): void {
        const column = vscode.ViewColumn.Beside;

        if (CodegenPreviewPanel.currentPanel) {
            CodegenPreviewPanel.currentPanel.update(fileName, pythonCode, typescriptCode);
            CodegenPreviewPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            CodegenPreviewPanel.viewType,
            `Codegen: ${fileName}`,
            column,
            { enableScripts: true }
        );

        CodegenPreviewPanel.currentPanel = new CodegenPreviewPanel(
            panel,
            fileName,
            pythonCode,
            typescriptCode
        );
    }

    public update(fileName: string, pythonCode: string, typescriptCode: string): void {
        this.fileName = fileName;
        this.pythonCode = pythonCode;
        this.typescriptCode = typescriptCode;
        this.panel.title = `Codegen: ${fileName}`;
        this.panel.webview.html = this.getHtml();
    }

    private dispose(): void {
        CodegenPreviewPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    private getHtml(): string {
        const pythonEscaped = this.escapeHtml(this.pythonCode);
        const typescriptEscaped = this.escapeHtml(this.typescriptCode);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Codegen Preview: ${this.escapeHtml(this.fileName)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
        }
        .tab-bar {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorGroupHeader-tabsBackground);
        }
        .tab {
            padding: 8px 16px;
            cursor: pointer;
            border: none;
            background: transparent;
            color: var(--vscode-tab-inactiveForeground);
            font-size: 13px;
            border-bottom: 2px solid transparent;
        }
        .tab.active {
            color: var(--vscode-tab-activeForeground);
            border-bottom-color: var(--vscode-focusBorder);
        }
        .tab:hover {
            color: var(--vscode-tab-activeForeground);
        }
        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 12px;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .toolbar .info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .save-btn {
            padding: 4px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            font-size: 12px;
            border-radius: 2px;
        }
        .save-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .code-panel {
            display: none;
            padding: 12px;
            overflow: auto;
            height: calc(100vh - 90px);
        }
        .code-panel.active {
            display: block;
        }
        pre {
            margin: 0;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
    </style>
</head>
<body>
    <div class="tab-bar">
        <button class="tab active" data-lang="python" onclick="switchTab('python')">Python / FastAPI</button>
        <button class="tab" data-lang="typescript" onclick="switchTab('typescript')">TypeScript / Express</button>
    </div>
    <div class="toolbar">
        <span class="info">Generated from ${this.escapeHtml(this.fileName)}</span>
        <button class="save-btn" onclick="saveFile()">Save to File</button>
    </div>
    <div id="python-panel" class="code-panel active">
        <pre><code>${pythonEscaped}</code></pre>
    </div>
    <div id="typescript-panel" class="code-panel">
        <pre><code>${typescriptEscaped}</code></pre>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let currentLang = 'python';

        function switchTab(lang) {
            currentLang = lang;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.tab[data-lang="' + lang + '"]').classList.add('active');
            document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(lang + '-panel').classList.add('active');
        }

        function saveFile() {
            vscode.postMessage({ command: 'save', language: currentLang });
        }
    </script>
</body>
</html>`;
    }
}
