import type { MermaidFixerSettings } from './types';

export const DEFAULT_SETTINGS: MermaidFixerSettings = {
	enabledRules: {
		seqMultiline: true,
		stateLabel: true,
		diamondGt: true,
		parenConflict: true,
		subgraphSpace: true,
		unquotedAmp: true,
	},
	showDiffBeforeApply: true,
	skipDirs: ['.git', 'node_modules'],
	maxFileSizeKb: 500,
};

export function normalizeSettings(
	data: Partial<MermaidFixerSettings> | null | undefined,
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
		showDiffBeforeApply:
			data?.showDiffBeforeApply ?? DEFAULT_SETTINGS.showDiffBeforeApply,
		skipDirs: Array.isArray(data?.skipDirs)
			? data.skipDirs
			: [...DEFAULT_SETTINGS.skipDirs],
		maxFileSizeKb,
	};
}
