import type { EnabledRules, FixResult, FixTuple, IssueKey } from './types';

export const MERMAID_REGEX = /(`{3,}|~{3,})[ \t]*mermaid[^\r\n]*\r?\n([\s\S]*?)\r?\n\1/gim;

const MERMAID_FENCE_REGEX = /(?:`{3,}|~{3,})[ \t]*mermaid\b/i;
const BARE_MERMAID_START_REGEX =
	/^(?:(?:flowchart|graph)\s+(?:TB|TD|BT|RL|LR)\b|(?:sequenceDiagram|classDiagram|classDiagram-v2|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|quadrantChart|requirementDiagram|xychart(?:-beta)?|sankey-beta|block-beta|packet-beta|architecture-beta|radar-beta|kanban|treemap-beta|info)\b)/i;
const QUOTED_SUBGRAPH_ID_TITLE_REGEX = /^"([A-Za-z_][\w-]*)\[([^\]\n]+)\]"$/;
const COMPACT_QUOTED_SUBGRAPH_ID_TITLE_REGEX = /^([A-Za-z_][\w-]*)\["([^"\n]+)"\]$/;
const FLOWCHART_EDGE_LABEL_REGEX = /\|([^|\r\n]+)\|/g;
const XYCHART_TITLE_REGEX = /^(\s*title\s+)(.+)$/gm;
const XYCHART_AXIS_LIST_REGEX = /^(\s*x-axis(?:\s+"[^"\r\n]+")?\s+)\[([^\]\r\n]+)\]\s*$/gm;
const XYCHART_SERIES_REGEX =
	/^(\s*(?:line|bar)\s+)\[([^\]\r\n]+)\]\s+([+-]?\d[\d\s.,+-]*)$/gm;
const QUADRANT_START_REGEX = /^\s*quadrantChart\s*$/im;

const ISSUE_TO_RULE: Record<IssueKey, keyof EnabledRules> = {
	seq_multiline: 'seqMultiline',
	state_label: 'stateLabel',
	diamond_gt: 'diamondGt',
	paren_conflict: 'parenConflict',
	subgraph_space: 'subgraphSpace',
	unquoted_amp: 'unquotedAmp',
	style_comment: 'styleComment',
	nested_quote: 'nestedQuote',
	c4_keyword: 'c4Keyword',
	edge_label_special: 'edgeLabelSpecial',
	xychart_syntax: 'xychartSyntax',
	quadrant_missing_type: 'quadrantMissingType',
};

export function detectIssues(block: string): IssueKey[] {
	const issues: IssueKey[] = [];

	if (/->>[:：]\s*\n\s+\w/.test(block)) {
		issues.push('seq_multiline');
	}
	if (/^\s*\w+\s+-->\s+\w+[:：]\s*.*[>+]/m.test(block)) {
		issues.push('state_label');
	}
	if (/\{[^}]*>[^}]*\}/.test(block)) {
		issues.push('diamond_gt');
	}
	if (/\[[^\]]*\([^\]]*\)/.test(block) || /\{[^}]*\[[^}]*\]/.test(block)) {
		issues.push('paren_conflict');
	}
	if (
		/^\s*subgraph\s+"[A-Za-z_][\w-]*\[[^\]\n]+\]"\s*$/m.test(block) ||
		/^\s*subgraph\s+[A-Za-z_][\w-]*\["[^"\n]+"\]\s*$/m.test(block) ||
		/^\s*subgraph\s+\S+\s+\S/m.test(block)
	) {
		issues.push('subgraph_space');
	}
	if (/[[{(][^\]})]*&[^\]})]*[\]})]/.test(block)) {
		issues.push('unquoted_amp');
	}
	if (/^\s*style\s+\S+\s+\S.*?[ \t]+%%.*$/m.test(block)) {
		issues.push('style_comment');
	}
	if (
		!isXychartBlock(block) &&
		(/^\s*subgraph\s+"[^"\n]*"[^"\n]*".*$/m.test(block) ||
			/\[[^\n\]]*"[^\n\]]*"[^\n\]]*"[^\n\]]*\]/.test(block))
	) {
		issues.push('nested_quote');
	}
	if (/^\s*(?:flowchart|graph)\b[\s\S]*\bC4(?:Context|Container|Component|Dynamic|Deployment)\b/.test(block)) {
		issues.push('c4_keyword');
	}
	if (hasSpecialFlowchartEdgeLabel(block)) {
		issues.push('edge_label_special');
	}
	if (hasXychartSyntaxIssue(block)) {
		issues.push('xychart_syntax');
	}
	if (hasMissingQuadrantChartType(block)) {
		issues.push('quadrant_missing_type');
	}

	return issues;
}

export function fixSequenceMultiline(block: string): FixTuple {
	const pattern = /^(\s*[\w\s]+->>[\w\s]+:\s*)(.+\n)(\s+.+\n)*(\s*\))/gm;
	let changes = 0;
	const fixed = block.replace(pattern, (match: string, prefix: string) => {
		changes += 1;
		const lines = splitLinesLikePython(match.slice(prefix.length));
		const collapsed = lines.map((line) => line.trim()).join(' ');
		return prefix + collapsed;
	});
	return [fixed, changes];
}

export function fixStateLabels(block: string): FixTuple {
	const pattern = /^(\s*\S+\s+-->\s+\S+:\s*)(.+)$/gm;
	let changes = 0;
	const fixed = block.replace(
		pattern,
		(match: string, prefix: string, labelRaw: string) => {
			const label = labelRaw.trim();
			if (isQuoted(label)) {
				return match;
			}
			if (label.includes('>') || label.includes('+')) {
				changes += 1;
				return `${prefix}"${label}"`;
			}
			return match;
		},
	);
	return [fixed, changes];
}

export function fixFlowchartDiamondGt(block: string): FixTuple {
	return quoteNodeText(block, '{', '}', (text) => text.includes('>'));
}

export function quoteNodeText(
	block: string,
	shapeOpen: string,
	shapeClose: string,
	shouldQuote: (text: string) => boolean,
): FixTuple {
	const pattern = new RegExp(
		`(\\b[\\w-]+\\s*${escapeRegExp(shapeOpen)})([^${escapeCharClass(
			shapeClose,
		)}\\n]+)(${escapeRegExp(shapeClose)})`,
		'g',
	);
	let changes = 0;
	const fixed = block.replace(
		pattern,
		(match: string, pre: string, text: string, post: string) => {
			const stripped = text.trim();
			if (isQuoted(stripped) || startsWithQuote(stripped)) {
				return match;
			}
			if (shouldQuote(text)) {
				changes += 1;
				return `${pre}"${text}"${post}`;
			}
			return match;
		},
	);
	return [fixed, changes];
}

export function fixNodeTextParens(block: string): FixTuple {
	let changes = 0;

	const squarePattern = /(\w+\[)([^\]]+)\]/g;
	let fixed = block.replace(
		squarePattern,
		(match: string, pre: string, text: string) => {
			const stripped = text.trim();
			if (isQuoted(stripped) || startsWithQuote(stripped)) {
				return match;
			}
			const hasRoundParens = text.includes('(') && text.includes(')');
			const hasCurlyParens = text.includes('{') && text.includes('}');
			if ((hasRoundParens || hasCurlyParens) && !text.includes('<br/>')) {
				changes += 1;
				return `${pre}"${text}"]`;
			}
			return match;
		},
	);

	const curlyPattern = /(\w+\{)([^}]+)\}/g;
	fixed = fixed.replace(
		curlyPattern,
		(match: string, pre: string, text: string) => {
			const stripped = text.trim();
			if (isQuoted(stripped) || startsWithQuote(stripped)) {
				return match;
			}
			if (text.includes('[') && text.includes(']')) {
				changes += 1;
				return `${pre}"${text}"}`;
			}
			return match;
		},
	);

	return [fixed, changes];
}

export function fixSubgraphTitles(block: string): FixTuple {
	const pattern = /^(\s*subgraph\s+)(.+)$/gm;
	let changes = 0;
	const fixed = block.replace(
		pattern,
		(match: string, prefix: string, titleRaw: string) => {
			const title = titleRaw.trim();
			const quotedIdTitle = QUOTED_SUBGRAPH_ID_TITLE_REGEX.exec(title);
			if (quotedIdTitle) {
				const subgraphId = quotedIdTitle[1];
				const subgraphTitle = quotedIdTitle[2];
				if (!subgraphId || subgraphTitle === undefined) {
					return match;
				}
				changes += 1;
				return `${prefix}${subgraphId} ["${cleanSubgraphTitle(subgraphTitle)}"]`;
			}

			const compactQuotedIdTitle =
				COMPACT_QUOTED_SUBGRAPH_ID_TITLE_REGEX.exec(title);
			if (compactQuotedIdTitle) {
				const subgraphId = compactQuotedIdTitle[1];
				const subgraphTitle = compactQuotedIdTitle[2];
				if (!subgraphId || subgraphTitle === undefined) {
					return match;
				}
				changes += 1;
				return `${prefix}${subgraphId} ["${cleanSubgraphTitle(subgraphTitle)}"]`;
			}
			if (isQuoted(title) || hasSubgraphIdQuotedTitle(title)) {
				return match;
			}
			if (title.includes(' ') || title.includes('\t')) {
				changes += 1;
				return `${prefix}"${title}"`;
			}
			return match;
		},
	);
	return [fixed, changes];
}

export function fixUnquotedAmpersand(block: string): FixTuple {
	let changes = 0;
	let fixed = block;

	for (const [shapeOpen, shapeClose] of [
		['[', ']'],
		['{', '}'],
		['(', ')'],
	] as const) {
		const [nextBlock, count] = quoteNodeText(
			fixed,
			shapeOpen,
			shapeClose,
			(text) => text.includes('&'),
		);
		fixed = nextBlock;
		changes += count;
	}

	return [fixed, changes];
}

export function fixStyleComments(block: string): FixTuple {
	const pattern = /^(\s*style\s+\S+\s+\S.*?)([ \t]+%%[^\r\n]*)$/gm;
	let changes = 0;
	const fixed = block.replace(
		pattern,
		(match: string, styleLine: string, comment: string) => {
			changes += 1;
			const indent = /^\s*/.exec(styleLine)?.[0] ?? '';
			return `${styleLine.trimEnd()}\n${indent}${comment.trimStart()}`;
		},
	);
	return [fixed, changes];
}

export function fixNestedQuotes(block: string): FixTuple {
	let changes = 0;
	const fixed = block
		.split(/\r?\n/)
		.map((line: string) => {
			let nextLine = line;
			const originalLine = line;
			const subgraphMatch = /^(\s*subgraph\s+")(.+)("\s*)$/.exec(nextLine);
			if (subgraphMatch?.[2]?.includes('"')) {
				nextLine = `${subgraphMatch[1]}${subgraphMatch[2].replace(/"/g, "'")}${subgraphMatch[3]}`;
			}

			for (const [open, close] of [
				['["', '"]'],
				['("', '")'],
				['{"', '"}'],
			] as const) {
				const start = nextLine.indexOf(open);
				const end = nextLine.lastIndexOf(close);
				if (start < 0 || end <= start + open.length) {
					continue;
				}
				const label = nextLine.slice(start + open.length, end);
				if (!label.includes('"')) {
					continue;
				}
				nextLine = `${nextLine.slice(0, start + open.length)}${label.replace(/"/g, "'")}${nextLine.slice(end)}`;
			}

			if (nextLine !== originalLine) {
				changes += 1;
			}
			return nextLine;
		})
		.join('\n');
	return [fixed, changes];
}

const C4_KEYWORD_REPLACEMENTS: Record<string, string> = {
	C4Context: 'C4Ctx',
	C4Container: 'C4Cont',
	C4Component: 'C4Comp',
	C4Dynamic: 'C4Dyn',
	C4Deployment: 'C4Deploy',
};

export function fixC4Keywords(block: string): FixTuple {
	if (!/^\s*(?:flowchart|graph)\b/m.test(block)) {
		return [block, 0];
	}

	let changes = 0;
	let fixed = block;
	for (const [keyword, replacement] of Object.entries(C4_KEYWORD_REPLACEMENTS)) {
		fixed = fixed.replace(new RegExp(`\\b${keyword}\\b`, 'g'), () => {
			changes += 1;
			return replacement;
		});
	}
	return [fixed, changes];
}

export function fixFlowchartEdgeLabels(block: string): FixTuple {
	if (!/^\s*(?:flowchart|graph)\b/m.test(block)) {
		return [block, 0];
	}

	let changes = 0;
	const fixed = block.replace(
		FLOWCHART_EDGE_LABEL_REGEX,
		(match: string, labelRaw: string) => {
			const label = labelRaw.trim();
			if (!shouldQuoteEdgeLabel(label)) {
				return match;
			}
			changes += 1;
			const leading = /^\s*/.exec(labelRaw)?.[0] ?? '';
			const trailing = /\s*$/.exec(labelRaw)?.[0] ?? '';
			return `|${leading}"${label.replace(/"/g, "'")}"${trailing}|`;
		},
	);
	return [fixed, changes];
}

export function fixXychartSyntax(block: string): FixTuple {
	if (!isXychartBlock(block)) {
		return [block, 0];
	}

	let changes = 0;
	let fixed = block.replace(
		XYCHART_TITLE_REGEX,
		(match: string, prefix: string, titleRaw: string) => {
			const title = titleRaw.trim();
			if (isQuoted(title) || title.length === 0) {
				return match;
			}
			changes += 1;
			return `${prefix}"${title.replace(/"/g, "'")}"`;
		},
	);

	fixed = fixed.replace(
		XYCHART_AXIS_LIST_REGEX,
		(match: string, prefix: string, categoriesRaw: string) => {
			const categories = categoriesRaw.split(',').map((category) => category.trim());
			if (
				categories.length === 0 ||
				categories.every(
					(category) => category.length === 0 || !needsXychartCategoryQuotes(category),
				)
			) {
				return match;
			}
			changes += 1;
			const normalized = categories
				.map((category) =>
					needsXychartCategoryQuotes(category)
						? `"${stripWrappingQuotes(category).replace(/"/g, "'")}"`
						: category,
				)
				.join(', ');
			return `${prefix}[${normalized}]`;
		},
	);

	fixed = fixed.replace(
		XYCHART_SERIES_REGEX,
		(match: string, prefix: string, labelRaw: string, valuesRaw: string) => {
			const label = labelRaw.trim();
			const values = valuesRaw.trim();
			if (values.length === 0 || label.split(',').length > 1) {
				return match;
			}
			changes += 1;
			return `${prefix}"${stripWrappingQuotes(label).replace(/"/g, "'")}" [${values}]`;
		},
	);

	return [fixed, changes];
}

export function fixMissingQuadrantChartType(block: string): FixTuple {
	if (!hasMissingQuadrantChartType(block)) {
		return [block, 0];
	}

	const leadingBlankLines = /^(?:[ \t]*\n)*/.exec(block)?.[0] ?? '';
	const rest = block.slice(leadingBlankLines.length);
	return [`${leadingBlankLines}quadrantChart\n${rest}`, 1];
}

export function fixMermaidBlocks(
	markdown: string,
	enabledRules?: Partial<EnabledRules>,
): FixResult {
	const logs: string[] = [];
	let changed = false;
	let sawFencedBlock = false;

	const text = markdown.replace(
		MERMAID_REGEX,
		(match: string, fence: string, block: string) => {
			sawFencedBlock = true;
			const result = fixMermaidBlockContent(
				normalizeLineEndings(block),
				enabledRules,
			);
			logs.push(...result.logs);
			if (!result.changed) {
				return match;
			}
			changed = true;
			return `${fence}mermaid\n${result.block}\n${fence}`;
		},
	);

	if (!sawFencedBlock && isBareMermaidDocument(markdown)) {
		const result = fixMermaidBlockContent(
			normalizeLineEndings(markdown.trim()),
			enabledRules,
		);
		return {
			text: `\`\`\`mermaid\n${result.block}\n\`\`\``,
			logs: ['bare_mermaid x1', ...result.logs],
			changed: true,
		};
	}

	return { text, logs, changed };
}

export function hasMermaidFixCandidate(markdown: string): boolean {
	return MERMAID_FENCE_REGEX.test(markdown) || isBareMermaidDocument(markdown);
}

export function isBareMermaidDocument(markdown: string): boolean {
	const trimmed = markdown.trim();
	return (
		trimmed.length > 0 &&
		!MERMAID_FENCE_REGEX.test(markdown) &&
		BARE_MERMAID_START_REGEX.test(trimmed)
	);
}

function fixMermaidBlockContent(
	block: string,
	enabledRules?: Partial<EnabledRules>,
): { block: string; logs: string[]; changed: boolean } {
	const logs: string[] = [];
	const issues = detectIssues(block);
	let nextBlock = block;

	for (const issue of issues) {
		if (!isRuleEnabled(issue, enabledRules)) {
			continue;
		}
		const [fixedBlock, count] = applyIssueFix(issue, nextBlock);
		nextBlock = fixedBlock;
		if (count > 0) {
			logs.push(`${issue} x${count}`);
		}
	}

	return { block: nextBlock, logs, changed: nextBlock !== block };
}

function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n?/g, '\n');
}

function applyIssueFix(issue: IssueKey, block: string): FixTuple {
	switch (issue) {
		case 'seq_multiline':
			return fixSequenceMultiline(block);
		case 'state_label':
			return fixStateLabels(block);
		case 'diamond_gt':
			return fixFlowchartDiamondGt(block);
		case 'paren_conflict':
			return fixNodeTextParens(block);
		case 'subgraph_space':
			return fixSubgraphTitles(block);
		case 'unquoted_amp':
			return fixUnquotedAmpersand(block);
		case 'style_comment':
			return fixStyleComments(block);
		case 'nested_quote':
			return fixNestedQuotes(block);
		case 'c4_keyword':
			return fixC4Keywords(block);
		case 'edge_label_special':
			return fixFlowchartEdgeLabels(block);
		case 'xychart_syntax':
			return fixXychartSyntax(block);
		case 'quadrant_missing_type':
			return fixMissingQuadrantChartType(block);
	}
}

function isRuleEnabled(
	issue: IssueKey,
	enabledRules?: Partial<EnabledRules>,
): boolean {
	return enabledRules?.[ISSUE_TO_RULE[issue]] ?? true;
}

function isQuoted(text: string): boolean {
	return text.startsWith('"') && text.endsWith('"');
}

function startsWithQuote(text: string): boolean {
	return text.startsWith('"') || text.startsWith("'");
}

function hasSubgraphIdQuotedTitle(title: string): boolean {
	return /^\S+\s+\[".*"\]$/.test(title);
}

function cleanSubgraphTitle(title: string): string {
	let cleaned = title.trim();
	if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
		cleaned = cleaned.slice(1, -1).trim();
	}
	return cleaned.replace(/"/g, "'");
}

function hasSpecialFlowchartEdgeLabel(block: string): boolean {
	if (!/^\s*(?:flowchart|graph)\b/m.test(block)) {
		return false;
	}

	FLOWCHART_EDGE_LABEL_REGEX.lastIndex = 0;
	for (const match of block.matchAll(FLOWCHART_EDGE_LABEL_REGEX)) {
		const label = match[1]?.trim() ?? '';
		if (shouldQuoteEdgeLabel(label)) {
			return true;
		}
	}
	return false;
}

function shouldQuoteEdgeLabel(label: string): boolean {
	return (
		label.length > 0 &&
		!isQuoted(label) &&
		!startsWithQuote(label) &&
		/[{}[\]()*]/.test(label)
	);
}

function hasXychartSyntaxIssue(block: string): boolean {
	XYCHART_SERIES_REGEX.lastIndex = 0;
	return (
		isXychartBlock(block) &&
		(hasUnquotedXychartTitle(block) ||
			hasUnquotedXychartCategory(block) ||
			XYCHART_SERIES_REGEX.test(block))
	);
}

function hasUnquotedXychartTitle(block: string): boolean {
	const titleRegex = /^(\s*title\s+)(.+)$/gm;
	for (const match of block.matchAll(titleRegex)) {
		const title = match[2]?.trim() ?? '';
		if (title.length > 0 && !isQuoted(title)) {
			return true;
		}
	}
	return false;
}

function hasUnquotedXychartCategory(block: string): boolean {
	const axisRegex = /^(\s*x-axis(?:\s+"[^"\r\n]+")?\s+)\[([^\]\r\n]+)\]\s*$/gm;
	for (const match of block.matchAll(axisRegex)) {
		const categories = match[2]?.split(',').map((category) => category.trim()) ?? [];
		if (categories.some((category) => needsXychartCategoryQuotes(category))) {
			return true;
		}
	}
	return false;
}

function hasMissingQuadrantChartType(block: string): boolean {
	return (
		!QUADRANT_START_REGEX.test(block) &&
		/^\s*title\s+.+$/im.test(block) &&
		/^\s*x-axis\s+.+\s+-->\s+.+$/im.test(block) &&
		/^\s*y-axis\s+.+\s+-->\s+.+$/im.test(block) &&
		/^\s*quadrant-[1-4]\s+.+$/im.test(block)
	);
}

function needsXychartCategoryQuotes(category: string): boolean {
	return (
		category.length > 0 &&
		!isQuoted(category) &&
		!startsWithQuote(category) &&
		/\s/.test(category)
	);
}

function isXychartBlock(block: string): boolean {
	return /^xychart(?:-beta)?(?:\s+(?:horizontal|vertical))?$/i.test(
		firstMeaningfulLine(block),
	);
}

function firstMeaningfulLine(block: string): string {
	return (
		block
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find((line) => line.length > 0 && !line.startsWith('%%')) ?? ''
	);
}

function stripWrappingQuotes(text: string): string {
	const trimmed = text.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function splitLinesLikePython(text: string): string[] {
	const lines = text.split(/\r?\n/);
	if (lines.length > 0 && lines[lines.length - 1] === '') {
		return lines.slice(0, -1);
	}
	return lines;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeCharClass(value: string): string {
	return value.replace(/[\\\]-]/g, '\\$&');
}
