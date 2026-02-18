import * as path from 'path';
import * as cp from 'child_process';
import { workspace, ExtensionContext, commands, window, Uri, OutputChannel } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import { CodegenPreviewPanel } from './codegenPreview';

let client: LanguageClient;
let outputChannel: OutputChannel;

function getConfig() {
    return workspace.getConfiguration('glyph');
}

function getGlyphPath(): string {
    return getConfig().get<string>('lsp.path') || 'glyph';
}

export function activate(context: ExtensionContext) {
    const config = getConfig();
    const lspPath = config.get<string>('lsp.path') || 'glyph';
    const logFile = config.get<string>('lsp.logFile') || '';

    outputChannel = window.createOutputChannel('Glyph Codegen');

    // Build server command
    const serverArgs = ['lsp'];
    if (logFile) {
        serverArgs.push('--log', logFile);
    }

    const serverOptions: ServerOptions = {
        command: lspPath,
        args: serverArgs,
        transport: TransportKind.stdio
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'glyph' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.{glyph,glybc}')
        }
    };

    client = new LanguageClient(
        'glyphLanguageServer',
        'Glyph Language Server',
        serverOptions,
        clientOptions
    );

    client.start();

    // Register codegen command
    const codegenCommand = commands.registerCommand('glyph.codegen', async (uri?: Uri) => {
        const fileUri = uri || window.activeTextEditor?.document.uri;
        if (!fileUri || !fileUri.fsPath.endsWith('.glyph')) {
            window.showErrorMessage('Please open or select a .glyph file to generate code.');
            return;
        }

        const defaultLang = getConfig().get<string>('codegen.defaultLanguage') || 'python';
        const languages = defaultLang === 'typescript'
            ? ['typescript', 'python']
            : ['python', 'typescript'];

        const lang = await window.showQuickPick(languages, {
            placeHolder: 'Select target language',
            title: 'Glyph: Generate Server Code'
        });

        if (!lang) {
            return;
        }

        const fileDir = path.dirname(fileUri.fsPath);
        const outputDir = path.join(fileDir, 'generated', lang);

        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine(`Generating ${lang} code from ${fileUri.fsPath}...`);

        try {
            const result = await execGlyph(getGlyphPath(), ['codegen', fileUri.fsPath, '--lang', lang, '-o', outputDir]);
            outputChannel.appendLine(result);
            outputChannel.appendLine('Code generation complete.');
            window.showInformationMessage(`Generated ${lang} code in ${outputDir}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            outputChannel.appendLine(`Error: ${message}`);
            window.showErrorMessage(`Code generation failed: ${message}`);
        }
    });

    // Register codegen preview command
    const previewCommand = commands.registerCommand('glyph.codegenPreview', async () => {
        const editor = window.activeTextEditor;
        if (!editor || !editor.document.uri.fsPath.endsWith('.glyph')) {
            window.showErrorMessage('Please open a .glyph file to preview generated code.');
            return;
        }

        const fileUri = editor.document.uri;
        const glyphPath = getGlyphPath();

        try {
            const [pythonCode, typescriptCode] = await Promise.all([
                execGlyph(glyphPath, ['codegen', fileUri.fsPath, '--lang', 'python']),
                execGlyph(glyphPath, ['codegen', fileUri.fsPath, '--lang', 'typescript'])
            ]);

            CodegenPreviewPanel.createOrShow(
                context.extensionUri,
                path.basename(fileUri.fsPath),
                pythonCode,
                typescriptCode
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            window.showErrorMessage(`Preview failed: ${message}`);
        }
    });

    // Watch for .glyph file changes to refresh preview
    const watcher = workspace.createFileSystemWatcher('**/*.glyph');
    watcher.onDidChange(async (uri) => {
        if (CodegenPreviewPanel.currentPanel) {
            const glyphPath = getGlyphPath();
            try {
                const [pythonCode, typescriptCode] = await Promise.all([
                    execGlyph(glyphPath, ['codegen', uri.fsPath, '--lang', 'python']),
                    execGlyph(glyphPath, ['codegen', uri.fsPath, '--lang', 'typescript'])
                ]);
                CodegenPreviewPanel.currentPanel.update(
                    path.basename(uri.fsPath),
                    pythonCode,
                    typescriptCode
                );
            } catch (err: unknown) {
                outputChannel.appendLine(`Preview refresh failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    });

    context.subscriptions.push(codegenCommand, previewCommand, outputChannel, watcher);
}

function execGlyph(glyphPath: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        cp.execFile(glyphPath, args, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve(stdout);
        });
    });
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
