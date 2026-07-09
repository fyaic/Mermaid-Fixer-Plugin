import type { TFile } from 'obsidian';

export const ISSUE_KEYS = [
	'seq_multiline',
	'state_label',
	'diamond_gt',
	'paren_conflict',
	'subgraph_space',
	'unquoted_amp',
	'style_comment',
	'single_percent_comment',
	'nested_quote',
	'c4_keyword',
	'edge_label_special',
	'xychart_syntax',
	'quadrant_missing_type',
	'quadrant_text',
] as const;

export type IssueKey = (typeof ISSUE_KEYS)[number];

export interface EnabledRules {
	seqMultiline: boolean;
	stateLabel: boolean;
	diamondGt: boolean;
	parenConflict: boolean;
	subgraphSpace: boolean;
	unquotedAmp: boolean;
	styleComment: boolean;
	singlePercentComment: boolean;
	nestedQuote: boolean;
	c4Keyword: boolean;
	edgeLabelSpecial: boolean;
	xychartSyntax: boolean;
	quadrantMissingType: boolean;
	quadrantText: boolean;
}

export interface TableRules {
	enabled: boolean;
	collapsedTables: boolean;
	separatorNormalization: boolean;
	blankLineCleanup: boolean;
	columnPadding: boolean;
}

export type TableRuleKey = Exclude<keyof TableRules, 'enabled'>;

export interface MermaidFixerSettings {
	enabledRules: EnabledRules;
	tableRules: TableRules;
	showDiffBeforeApply: boolean;
	skipDirs: string[];
	maxFileSizeKb: number;
}

export interface FixResult {
	text: string;
	logs: string[];
	changed: boolean;
}

export interface MermaidSyntaxError {
	blockIndex: number;
	message: string;
	excerpt: string;
}

export interface PendingFileFix {
	file: TFile;
	original: string;
	fixed: string;
	logs: string[];
}

export interface VaultScanProgress {
	scannedFiles: number;
	totalFiles: number;
	issueFiles: number;
	currentFile?: string;
}

export type VaultScanProgressCallback = (progress: VaultScanProgress) => void;

export type FixTuple = [string, number];
