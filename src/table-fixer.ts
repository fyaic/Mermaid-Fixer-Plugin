import type { FixResult, TableRules } from './types';

const DEFAULT_TABLE_RULES: TableRules = {
	enabled: true,
	collapsedTables: true,
	separatorNormalization: true,
	blankLineCleanup: true,
	columnPadding: true,
};

type LogKey =
	| 'table_blank_line'
	| 'table_collapsed'
	| 'table_column_padding'
	| 'table_separator';

interface ParsedRow {
	cells: string[];
	isSeparator: boolean;
}

interface RepairResult {
	lines: string[];
	logs: Partial<Record<LogKey, number>>;
	consumed: number;
}

interface LineToken {
	raw: string;
	text: string;
	eol: string;
}

export function fixMarkdownTables(
	markdown: string,
	rules?: Partial<TableRules>,
): FixResult {
	const tableRules = { ...DEFAULT_TABLE_RULES, ...(rules ?? {}) };
	if (!tableRules.enabled) {
		return { text: markdown, logs: [], changed: false };
	}

	const logs: Partial<Record<LogKey, number>> = {};
	const text = repairOutsideFences(markdown, tableRules, logs);
	return {
		text,
		logs: formatLogs(logs),
		changed: text !== markdown,
	};
}

export function splitTableCells(row: string): string[] {
	const cells: string[] = [];
	let current = '';
	let codeTicks = 0;

	for (let index = 0; index < row.length; index += 1) {
		const char = row.charAt(index);
		if (char === '\\' && index + 1 < row.length) {
			current += char + row.charAt(index + 1);
			index += 1;
			continue;
		}

		if (char === '`') {
			const runLength = countBacktickRun(row, index);
			const run = row.slice(index, index + runLength);
			if (codeTicks === 0) {
				codeTicks = runLength;
			} else if (codeTicks === runLength) {
				codeTicks = 0;
			}
			current += run;
			index += runLength - 1;
			continue;
		}

		if (char === '|' && codeTicks === 0) {
			cells.push(current.trim());
			current = '';
			continue;
		}

		current += char;
	}

	cells.push(current.trim());

	if (startsWithPipe(row) && cells[0] === '') {
		cells.shift();
	}
	if (endsWithPipe(row) && cells[cells.length - 1] === '') {
		cells.pop();
	}

	return cells;
}

function repairOutsideFences(
	markdown: string,
	rules: TableRules,
	logs: Partial<Record<LogKey, number>>,
): string {
	const tokens = splitLineTokens(markdown);
	let inFence = false;
	let fenceChar = '';
	let fenceLength = 0;
	let buffer = '';
	let output = '';

	for (const token of tokens) {
		const fence = detectFence(token.text);
		if (!inFence && fence) {
			output += repairSegment(buffer, rules, logs);
			buffer = '';
			inFence = true;
			fenceChar = fence.char;
			fenceLength = fence.length;
			output += token.raw;
			continue;
		}

		if (inFence) {
			output += token.raw;
			const closingFence = detectFence(token.text);
			if (
				closingFence &&
				closingFence.char === fenceChar &&
				closingFence.length >= fenceLength
			) {
				inFence = false;
			}
			continue;
		}

		buffer += token.raw;
	}

	return output + repairSegment(buffer, rules, logs);
}

function repairSegment(
	segment: string,
	rules: TableRules,
	logs: Partial<Record<LogKey, number>>,
): string {
	if (!segment.includes('|')) {
		return segment;
	}

	const eol = segment.includes('\r\n') ? '\r\n' : '\n';
	const hasTrailingEol = /(?:\r\n|\n|\r)$/.test(segment);
	const lines = segment.split(/\r\n|\n|\r/);
	if (hasTrailingEol) {
		lines.pop();
	}

	const repairedLines: string[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (line === undefined) {
			continue;
		}
		const repair =
			repairCollapsedLine(line, rules) ??
			repairSeparatorContinuation(lines, index, rules) ??
			repairTableBlock(lines, index, rules);

		if (repair) {
			repairedLines.push(...repair.lines);
			mergeLogs(logs, repair.logs);
			index += repair.consumed - 1;
			continue;
		}

		repairedLines.push(line);
	}

	return repairedLines.join(eol) + (hasTrailingEol ? eol : '');
}

function repairCollapsedLine(
	line: string,
	rules: TableRules,
): RepairResult | null {
	if (!rules.collapsedTables) {
		return null;
	}

	const repaired = expandCollapsedCells(splitTableCells(line));
	if (!repaired) {
		return null;
	}

	return {
		lines: repaired,
		logs: { table_collapsed: 1 },
		consumed: 1,
	};
}

function repairSeparatorContinuation(
	lines: string[],
	index: number,
	rules: TableRules,
): RepairResult | null {
	if (!rules.collapsedTables || index + 1 >= lines.length) {
		return null;
	}

	const currentLine = lines[index];
	const nextLine = lines[index + 1];
	if (currentLine === undefined || nextLine === undefined) {
		return null;
	}

	const header = parseTableRow(currentLine);
	const nextCells = splitTableCells(nextLine);
	if (!header || header.isSeparator || nextCells.length === 0) {
		return null;
	}

	const separatorCount = countSeparatorRun(nextCells, 0);
	if (separatorCount !== header.cells.length || separatorCount < 2) {
		return null;
	}

	const bodyCells = nextCells.slice(separatorCount);
	if (
		bodyCells.length === 0 ||
		bodyCells.length % header.cells.length !== 0
	) {
		return null;
	}

	return {
		lines: [
			formatRow(header.cells),
			formatRow(Array.from({ length: header.cells.length }, () => ':---')),
			...chunkCells(bodyCells, header.cells.length).map(formatRow),
		],
		logs: { table_collapsed: 1 },
		consumed: 2,
	};
}

function repairTableBlock(
	lines: string[],
	index: number,
	rules: TableRules,
): RepairResult | null {
	if (index + 1 >= lines.length) {
		return null;
	}

	const headerLine = lines[index];
	const separatorLine = lines[index + 1];
	if (headerLine === undefined || separatorLine === undefined) {
		return null;
	}

	const header = parseTableRow(headerLine);
	const separator = parseTableRow(separatorLine);
	if (
		!header ||
		header.isSeparator ||
		!separator ||
		!separator.isSeparator ||
		separator.cells.length !== header.cells.length
	) {
		return null;
	}

	const columnCount = header.cells.length;
	const repairedLines = [headerLine];
	const localLogs: Partial<Record<LogKey, number>> = {};

	const normalizedSeparator = formatRow(
		Array.from({ length: columnCount }, () => ':---'),
	);
	if (rules.separatorNormalization && separatorLine !== normalizedSeparator) {
		repairedLines.push(normalizedSeparator);
		localLogs.table_separator = 1;
	} else {
		repairedLines.push(separatorLine);
	}

	let consumed = 2;
	for (let cursor = index + 2; cursor < lines.length; cursor += 1) {
		const line = lines[cursor];
		if (line === undefined) {
			break;
		}
		if (line.trim().length === 0) {
			const next = parseTableRow(lines[cursor + 1] ?? '');
			if (
				rules.blankLineCleanup &&
				next &&
				!next.isSeparator &&
				next.cells.length <= columnCount
			) {
				localLogs.table_blank_line = (localLogs.table_blank_line ?? 0) + 1;
				consumed += 1;
				continue;
			}
			break;
		}

		const parsed = parseTableRow(line);
		if (!parsed || parsed.isSeparator) {
			break;
		}

		if (rules.columnPadding && parsed.cells.length < columnCount) {
			repairedLines.push(
				formatRow([
					...parsed.cells,
					...Array.from(
						{ length: columnCount - parsed.cells.length },
						() => '',
					),
				]),
			);
			localLogs.table_column_padding =
				(localLogs.table_column_padding ?? 0) + 1;
		} else {
			repairedLines.push(line);
		}
		consumed += 1;
	}

	if (Object.values(localLogs).every((count) => !count)) {
		return null;
	}

	return {
		lines: repairedLines,
		logs: localLogs,
		consumed,
	};
}

function expandCollapsedCells(cells: string[]): string[] | null {
	const separatorStart = cells.findIndex(isSeparatorCell);
	if (separatorStart < 2) {
		return null;
	}

	const separatorCount = countSeparatorRun(cells, separatorStart);
	if (separatorCount !== separatorStart) {
		return null;
	}

	const bodyCells = cells.slice(separatorStart + separatorCount);
	if (
		bodyCells.length === 0 ||
		bodyCells.length % separatorStart !== 0
	) {
		return null;
	}

	return [
		formatRow(cells.slice(0, separatorStart)),
		formatRow(Array.from({ length: separatorStart }, () => ':---')),
		...chunkCells(bodyCells, separatorStart).map(formatRow),
	];
}

function parseTableRow(line: string): ParsedRow | null {
	const cells = splitTableCells(line);
	if (cells.length < 2) {
		return null;
	}

	return {
		cells,
		isSeparator: cells.every(isSeparatorCell),
	};
}

function splitLineTokens(text: string): LineToken[] {
	const tokens: LineToken[] = [];
	const regex = /([^\r\n]*)(\r\n|\n|\r|$)/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(text)) !== null) {
		const line = match[1] ?? '';
		const eol = match[2] ?? '';
		if (line === '' && eol === '') {
			break;
		}
		tokens.push({
			text: line,
			eol,
			raw: `${line}${eol}`,
		});
	}
	return tokens;
}

function detectFence(line: string): { char: string; length: number } | null {
	const match = /^(\s*)(`{3,}|~{3,})/.exec(line);
	if (!match) {
		return null;
	}
	const marker = match[2];
	if (!marker) {
		return null;
	}
	return {
		char: marker.charAt(0),
		length: marker.length,
	};
}

function formatRow(cells: string[]): string {
	return `|${cells
		.map((cell) => {
			const trimmed = cell.trim();
			return trimmed.length === 0 ? ' |' : ` ${trimmed} |`;
		})
		.join('')}`;
}

function chunkCells(cells: string[], size: number): string[][] {
	const chunks: string[][] = [];
	for (let index = 0; index < cells.length; index += size) {
		chunks.push(cells.slice(index, index + size));
	}
	return chunks;
}

function isSeparatorCell(cell: string): boolean {
	return /^:?-{3,}:?$/.test(cell.trim());
}

function countSeparatorRun(cells: string[], start: number): number {
	let count = 0;
	for (let index = start; index < cells.length; index += 1) {
		const cell = cells[index];
		if (cell === undefined || !isSeparatorCell(cell)) {
			break;
		}
		count += 1;
	}
	return count;
}

function countBacktickRun(text: string, start: number): number {
	let count = 0;
	for (let index = start; index < text.length; index += 1) {
		if (text.charAt(index) !== '`') {
			break;
		}
		count += 1;
	}
	return count;
}

function startsWithPipe(row: string): boolean {
	return row.trimStart().startsWith('|');
}

function endsWithPipe(row: string): boolean {
	const trimmed = row.trimEnd();
	return trimmed.endsWith('|') && !trimmed.endsWith('\\|');
}

function mergeLogs(
	target: Partial<Record<LogKey, number>>,
	source: Partial<Record<LogKey, number>>,
) {
	for (const [key, count] of Object.entries(source) as Array<[LogKey, number]>) {
		if (count > 0) {
			target[key] = (target[key] ?? 0) + count;
		}
	}
}

function formatLogs(logs: Partial<Record<LogKey, number>>): string[] {
	return Object.entries(logs)
		.filter(([, count]) => count > 0)
		.map(([key, count]) => `${key} x${count}`);
}
