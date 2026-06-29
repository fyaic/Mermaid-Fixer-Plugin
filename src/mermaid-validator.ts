import { Component, MarkdownRenderer, type App } from 'obsidian';
import { MERMAID_REGEX } from './fixer';
import type { MermaidSyntaxError } from './types';

const MERMAID_ERROR_TEXT_REGEX =
	/Error parsing Mermaid diagram|Lexical error|Parse error|UnknownDiagramError/i;

export async function validateMermaidSyntax(
	app: App,
	markdown: string,
	sourcePath: string,
): Promise<MermaidSyntaxError[]> {
	const blocks = extractMermaidBlocks(markdown);
	if (blocks.length === 0) {
		return [];
	}

	const container = activeDocument.createElement('div');
	container.addClass('mermaid-fixer-render-probe');
	activeDocument.body.appendChild(container);

	try {
		const errors: MermaidSyntaxError[] = [];
		for (const block of blocks) {
			container.replaceChildren();
			const component = new Component();
			component.load();
			try {
				await MarkdownRenderer.render(
					app,
					`\`\`\`mermaid\n${block.code}\n\`\`\``,
					container,
					sourcePath,
					component,
				);
				const message = extractMermaidErrorMessage(container);
				if (message) {
					errors.push({
						blockIndex: block.index,
						message,
						excerpt: firstMeaningfulLine(block.code),
					});
				}
			} catch (error) {
				errors.push({
					blockIndex: block.index,
					message: error instanceof Error ? error.message : String(error),
					excerpt: firstMeaningfulLine(block.code),
				});
			} finally {
				component.unload();
			}
		}
		return errors;
	} finally {
		container.remove();
	}
}

function extractMermaidBlocks(markdown: string): Array<{
	index: number;
	code: string;
}> {
	const blocks: Array<{ index: number; code: string }> = [];
	MERMAID_REGEX.lastIndex = 0;
	for (const match of markdown.matchAll(MERMAID_REGEX)) {
		blocks.push({
			index: blocks.length + 1,
			code: match[2] ?? '',
		});
	}
	return blocks;
}

function extractMermaidErrorMessage(container: HTMLElement): string | null {
	const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
	if (!MERMAID_ERROR_TEXT_REGEX.test(text)) {
		return null;
	}
	return text.length > 300 ? `${text.slice(0, 297)}...` : text;
}

function firstMeaningfulLine(code: string): string {
	return (
		code
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find((line) => line.length > 0 && !line.startsWith('%%')) ?? '(empty)'
	);
}
