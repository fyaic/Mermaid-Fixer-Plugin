import { MarkdownView, Notice } from 'obsidian';
import { fixMarkdownContent } from './content-fixer';
import {
	DiffModal,
	SyntaxReportModal,
	VaultScanProgressModal,
	VaultSummaryModal,
} from './diff-modal';
import type MermaidFixerPlugin from './main';
import { validateMermaidSyntax } from './mermaid-validator';
import type { PendingFileFix } from './types';
import { scanVaultForFixes } from './vault-scanner';

export function registerCommands(plugin: MermaidFixerPlugin) {
	plugin.addCommand({
		id: 'fix-current-file',
		name: 'Fix current file',
		callback: async () => {
			const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			const editor = view?.editor;
			if (!editor) {
				new Notice('Open a Markdown file in edit mode before running Mermaid fixer.');
				return;
			}

			const original = editor.getValue();
			const result = fixMarkdownContent(original, plugin.settings);
			const syntaxErrors = await validateMermaidSyntax(
				plugin.app,
				result.text,
				view.file?.path ?? '',
			);

			if (!result.changed) {
				if (syntaxErrors.length > 0) {
					new SyntaxReportModal(plugin.app, syntaxErrors).open();
					return;
				}
				new Notice('All Mermaid and table are good.');
				return;
			}

			const applyFix = async () => {
				editor.setValue(result.text);
				const fixedCount = countFixes(result.logs);
				if (syntaxErrors.length > 0) {
					new Notice(
						`Fixed ${fixedCount} issue(s); ${syntaxErrors.length} Mermaid syntax error(s) remain.`,
					);
					return;
				}
				new Notice(`Fixed ${fixedCount} Markdown issue(s) in current file.`);
			};

			if (plugin.settings.showDiffBeforeApply) {
				new DiffModal(
					plugin.app,
					original,
					result.text,
					result.logs,
					syntaxErrors,
					applyFix,
				).open();
			} else {
				await applyFix();
			}
		},
	});

	plugin.addCommand({
		id: 'fix-whole-vault',
		name: 'Fix whole vault',
		callback: async () => {
			const progressModal = new VaultScanProgressModal(plugin.app);
			progressModal.open();
			let fixes: PendingFileFix[];
			try {
				fixes = await scanVaultForFixes(
					plugin.app,
					plugin.settings,
					(progress) => progressModal.updateProgress(progress),
				);
			} finally {
				progressModal.close();
			}
			if (fixes.length === 0) {
				new Notice('All Mermaid and table are good.');
				return;
			}

			const applyAll = async () => {
				const summary = await applyVaultFixes(plugin, fixes);
				if (summary.failed.length > 0) {
					new Notice(
						`Applied fixes to ${summary.applied} file(s); ${summary.failed.length} file(s) failed.`,
					);
					return;
				}
				new Notice(
					`Fixed ${summary.issueCount} Markdown issue(s) in ${summary.applied} file(s).`,
				);
			};

			new VaultSummaryModal(
				plugin.app,
				fixes,
				plugin.settings.showDiffBeforeApply,
				applyAll,
			).open();
		},
	});
}

async function applyVaultFixes(
	plugin: MermaidFixerPlugin,
	fixes: PendingFileFix[],
): Promise<{
	applied: number;
	failed: Array<{ path: string; message: string }>;
	issueCount: number;
}> {
	let applied = 0;
	const failed: Array<{ path: string; message: string }> = [];

	for (const fix of fixes) {
		try {
			await plugin.app.vault.process(fix.file, (current) => {
				const result = fixMarkdownContent(current, plugin.settings);
				return result.changed ? result.text : current;
			});
			applied += 1;
		} catch (error) {
			failed.push({
				path: fix.file.path,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return {
		applied,
		failed,
		issueCount: fixes.reduce((total, fix) => total + countFixes(fix.logs), 0),
	};
}

function countFixes(logs: string[]): number {
	return logs.reduce((total, log) => {
		const match = / x(\d+)$/.exec(log);
		return total + (match ? Number(match[1]) : 1);
	}, 0);
}
