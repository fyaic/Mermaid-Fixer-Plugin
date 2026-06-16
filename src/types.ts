import type { TFile } from 'obsidian';

export const ISSUE_KEYS = [
	'seq_multiline',
	'state_label',
	'diamond_gt',
	'paren_conflict',
	'subgraph_space',
	'unquoted_amp',
] as const;

export type IssueKey = (typeof ISSUE_KEYS)[number];

export interface EnabledRules {
	seqMultiline: boolean;
	stateLabel: boolean;
	diamondGt: boolean;
	parenConflict: boolean;
	subgraphSpace: boolean;
	unquotedAmp: boolean;
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
