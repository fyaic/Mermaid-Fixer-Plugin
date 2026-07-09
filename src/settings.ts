import type { EnabledRules, MermaidFixerSettings, TableRules } from './types';

type RawSettings = Partial<
	Omit<MermaidFixerSettings, 'enabledRules' | 'tableRules'>
> & {
	enabledRules?: Partial<EnabledRules>;
	tableRules?: Partial<TableRules>;
};

export const DEFAULT_SETTINGS: MermaidFixerSettings = {
	enabledRules: {
		seqMultiline: true,
		stateLabel: true,
		diamondGt: true,
		parenConflict: true,
		subgraphSpace: true,
		unquotedAmp: true,
		styleComment: true,
		singlePercentComment: true,
		nestedQuote: true,
		c4Keyword: true,
		edgeLabelSpecial: true,
		xychartSyntax: true,
		quadrantMissingType: true,
		quadrantText: true,
	},
	tableRules: {
		enabled: true,
		collapsedTables: true,
		separatorNormalization: true,
		blankLineCleanup: true,
		columnPadding: true,
	},
	showDiffBeforeApply: true,
	skipDirs: ['.git', 'node_modules'],
	maxFileSizeKb: 500,
};

export function normalizeSettings(
	data: RawSettings | null | undefined,
): MermaidFixerSettings {
	const maxFileSizeKb =
		typeof data?.maxFileSizeKb === 'number' && data.maxFileSizeKb > 0
			? data.maxFileSizeKb
			: DEFAULT_SETTINGS.maxFileSizeKb;

	return {
		...DEFAULT_SETTINGS,
		...data,
		enabledRules: {
			...DEFAULT_SETTINGS.enabledRules,
			...(data?.enabledRules ?? {}),
		},
		tableRules: {
			...DEFAULT_SETTINGS.tableRules,
			...(data?.tableRules ?? {}),
		},
		showDiffBeforeApply:
			data?.showDiffBeforeApply ?? DEFAULT_SETTINGS.showDiffBeforeApply,
		skipDirs: Array.isArray(data?.skipDirs)
			? data.skipDirs
			: [...DEFAULT_SETTINGS.skipDirs],
		maxFileSizeKb,
	};
}
