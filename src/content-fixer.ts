import { fixMermaidBlocks } from './fixer';
import { fixMarkdownTables } from './table-fixer';
import type { FixResult, MermaidFixerSettings } from './types';

export function fixMarkdownContent(
	markdown: string,
	settings: MermaidFixerSettings,
): FixResult {
	const mermaidResult = fixMermaidBlocks(markdown, settings.enabledRules);
	const tableResult = fixMarkdownTables(
		mermaidResult.text,
		settings.tableRules,
	);

	return {
		text: tableResult.text,
		logs: [...mermaidResult.logs, ...tableResult.logs],
		changed: mermaidResult.changed || tableResult.changed,
	};
}

export function hasMarkdownFixCandidate(markdown: string): boolean {
	return markdown.toLowerCase().includes('```mermaid') || markdown.includes('|');
}
