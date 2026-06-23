import type { EnabledRules, FixResult, FixTuple, IssueKey } from './types';

export const MERMAID_REGEX = /```mermaid\n(.*?)\n```/gis;

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
	if (/^\s*subgraph\s+\S+\s+\S/m.test(block)) {
		issues.push('subgraph_space');
	}
	if (/[[{(][^\]})]*&[^\]})]*[\]})]/.test(block)) {
		issues.push('unquoted_amp');
	}
	if (/^\s*style\s+\S+\s+\S.*?[ \t]+%%.*$/m.test(block)) {
		issues.push('style_comment');
	}
	if (
		/^\s*subgraph\s+"[^"\n]*"[^"\n]*".*$/m.test(block) ||
		/\[[^\n\]]*"[^\n\]]*"[^\n\]]*"[^\n\]]*\]/.test(block)
	) {
		issues.push('nested_quote');
	}
	if (/^\s*(?:flowchart|graph)\b[\s\S]*\bC4(?:Context|Container|Component|Dynamic|Deployment)\b/.test(block)) {
		issues.push('c4_keyword');
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

export function fixMermaidBlocks(
	markdown: string,
	enabledRules?: Partial<EnabledRules>,
): FixResult {
	const logs: string[] = [];
	let changed = false;

	const text = markdown.replace(
		MERMAID_REGEX,
		(match: string, block: string) => {
			const issues = detectIssues(block);
			if (issues.length === 0) {
				return match;
			}

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

			if (nextBlock !== block) {
				changed = true;
				return `\`\`\`mermaid\n${nextBlock}\n\`\`\``;
			}
			return match;
		},
	);

	return { text, logs, changed };
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
