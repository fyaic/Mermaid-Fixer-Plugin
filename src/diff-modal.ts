import { App, Modal, Setting } from 'obsidian';
import type {
	MermaidSyntaxError,
	PendingFileFix,
	VaultScanProgress,
} from './types';

export class DiffModal extends Modal {
	private readonly original: string;
	private readonly fixed: string;
	private readonly logs: string[];
	private readonly syntaxErrors: MermaidSyntaxError[];
	private readonly onApply: () => Promise<void>;

	constructor(
		app: App,
		original: string,
		fixed: string,
		logs: string[],
		syntaxErrors: MermaidSyntaxError[],
		onApply: () => Promise<void>,
	) {
		super(app);
		this.original = original;
		this.fixed = fixed;
		this.logs = logs;
		this.syntaxErrors = syntaxErrors;
		this.onApply = onApply;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('mermaid-fixer-modal');
		contentEl.createEl('h2', { text: 'Mermaid fixer - preview changes' });
		renderLogSummary(contentEl, this.logs);
		renderSyntaxErrors(contentEl, this.syntaxErrors);
		renderDiff(contentEl, this.original, this.fixed);
		renderFooter(contentEl, 'Apply', async () => {
			await this.onApply();
			this.close();
		}, () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class SyntaxReportModal extends Modal {
	private readonly syntaxErrors: MermaidSyntaxError[];

	constructor(app: App, syntaxErrors: MermaidSyntaxError[]) {
		super(app);
		this.syntaxErrors = syntaxErrors;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('mermaid-fixer-modal');
		contentEl.createEl('h2', { text: 'Mermaid fixer - syntax errors' });
		renderSyntaxErrors(contentEl, this.syntaxErrors);
		renderCloseFooter(contentEl, () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class VaultSummaryModal extends Modal {
	private readonly fixes: PendingFileFix[];
	private readonly showDiffs: boolean;
	private readonly onApplyAll: () => Promise<void>;

	constructor(
		app: App,
		fixes: PendingFileFix[],
		showDiffs: boolean,
		onApplyAll: () => Promise<void>,
	) {
		super(app);
		this.fixes = fixes;
		this.showDiffs = showDiffs;
		this.onApplyAll = onApplyAll;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('mermaid-fixer-modal');
		contentEl.createEl('h2', { text: 'Mermaid fixer - vault scan results' });

		const issueCount = this.fixes.reduce(
			(total, fix) => total + countFixes(fix.logs),
			0,
		);
		contentEl.createEl('p', {
			text: `${this.fixes.length} file(s) will be changed, ${issueCount} issue(s) total.`,
		});

		const listEl = contentEl.createDiv({ cls: 'mermaid-fixer-file-list' });
		for (const fix of this.fixes) {
			if (this.showDiffs) {
				const details = listEl.createEl('details', {
					cls: 'mermaid-fixer-file',
				});
				details.createEl('summary', {
					text: `${fix.file.path} - ${fix.logs.join(', ')}`,
				});
				renderDiff(details, fix.original, fix.fixed);
			} else {
				listEl.createDiv({
					cls: 'mermaid-fixer-file',
					text: `${fix.file.path} - ${fix.logs.join(', ')}`,
				});
			}
		}

		renderFooter(contentEl, 'Apply all', async () => {
			await this.onApplyAll();
			this.close();
		}, () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class VaultScanProgressModal extends Modal {
	private progress: VaultScanProgress = {
		scannedFiles: 0,
		totalFiles: 0,
		issueFiles: 0,
	};
	private statusEl?: HTMLElement;
	private barEl?: HTMLElement;
	private detailEl?: HTMLElement;

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('mermaid-fixer-modal');
		contentEl.createEl('h2', { text: 'Scanning vault' });
		this.statusEl = contentEl.createEl('p');
		const progressOuter = contentEl.createDiv({
			cls: 'mermaid-fixer-progress',
		});
		this.barEl = progressOuter.createDiv({
			cls: 'mermaid-fixer-progress-bar',
		});
		this.detailEl = contentEl.createEl('p', {
			cls: 'mermaid-fixer-progress-detail',
		});
		this.renderProgress();
	}

	onClose() {
		this.contentEl.empty();
	}

	updateProgress(progress: VaultScanProgress) {
		this.progress = progress;
		this.renderProgress();
	}

	private renderProgress() {
		if (!this.statusEl || !this.barEl || !this.detailEl) {
			return;
		}

		const percent =
			this.progress.totalFiles > 0
				? Math.round(
						(this.progress.scannedFiles / this.progress.totalFiles) * 100,
					)
				: 0;
		this.statusEl.setText(
			`${this.progress.scannedFiles} / ${this.progress.totalFiles} files scanned. ${this.progress.issueFiles} file(s) with issues found.`,
		);
		this.barEl.style.width = `${percent}%`;
		this.detailEl.setText(
			this.progress.currentFile
				? `Current file: ${this.progress.currentFile}`
				: 'Preparing scan...',
		);
	}
}

export function createUnifiedDiff(original: string, fixed: string): string[] {
	const originalLines = original.split(/\r?\n/);
	const fixedLines = fixed.split(/\r?\n/);
	const lines: string[] = ['--- original', '+++ fixed'];
	const maxLength = Math.max(originalLines.length, fixedLines.length);

	for (let index = 0; index < maxLength; index += 1) {
		const before = originalLines[index];
		const after = fixedLines[index];
		if (before === after) {
			lines.push(` ${before ?? ''}`);
			continue;
		}
		if (before !== undefined) {
			lines.push(`-${before}`);
		}
		if (after !== undefined) {
			lines.push(`+${after}`);
		}
	}

	return lines;
}

function renderDiff(containerEl: HTMLElement, original: string, fixed: string) {
	const pre = containerEl.createEl('pre', { cls: 'mermaid-fixer-diff' });
	for (const line of createUnifiedDiff(original, fixed)) {
		const cls = line.startsWith('+')
			? 'added'
			: line.startsWith('-')
				? 'removed'
				: 'context';
		pre.createEl('div', { cls, text: line });
	}
}

function renderLogSummary(containerEl: HTMLElement, logs: string[]) {
	if (logs.length === 0) {
		return;
	}
	containerEl.createEl('p', { text: `Fixes: ${logs.join(', ')}` });
}

function renderSyntaxErrors(
	containerEl: HTMLElement,
	syntaxErrors: MermaidSyntaxError[],
) {
	if (syntaxErrors.length === 0) {
		return;
	}

	containerEl.createEl('p', {
		text: `Mermaid parser still reports ${syntaxErrors.length} error(s).`,
	});
	const listEl = containerEl.createEl('ul', {
		cls: 'mermaid-fixer-syntax-errors',
	});
	for (const error of syntaxErrors) {
		listEl.createEl('li', {
			text: `Block ${error.blockIndex}: ${error.excerpt} - ${error.message}`,
		});
	}
}

function renderFooter(
	containerEl: HTMLElement,
	applyText: string,
	onApply: () => Promise<void>,
	onCancel: () => void,
) {
	new Setting(containerEl)
		.addButton((button) =>
			button.setButtonText('Cancel').onClick(() => {
				onCancel();
			}),
		)
		.addButton((button) =>
			button
				.setButtonText(applyText)
				.setCta()
				.onClick(async () => {
					await onApply();
				}),
		);
}

function renderCloseFooter(containerEl: HTMLElement, onClose: () => void) {
	new Setting(containerEl).addButton((button) =>
		button
			.setButtonText('Close')
			.setCta()
			.onClick(() => {
				onClose();
			}),
	);
}

function countFixes(logs: string[]): number {
	return logs.reduce((total, log) => {
		const match = / x(\d+)$/.exec(log);
		return total + (match ? Number(match[1]) : 1);
	}, 0);
}
