import type { App, TFile } from 'obsidian';
import { fixMermaidBlocks } from './fixer';
import type { MermaidFixerSettings, PendingFileFix } from './types';

export async function scanVaultForFixes(
	app: App,
	settings: MermaidFixerSettings,
): Promise<PendingFileFix[]> {
	const fixes: PendingFileFix[] = [];
	const files = app.vault.getMarkdownFiles();

	for (const file of files) {
		if (shouldSkipFile(file, settings, app.vault.configDir)) {
			continue;
		}

		let original: string;
		try {
			original = await app.vault.read(file);
		} catch {
			continue;
		}

		if (!original.toLowerCase().includes('```mermaid')) {
			continue;
		}

		const result = fixMermaidBlocks(original, settings.enabledRules);
		if (result.changed) {
			fixes.push({
				file,
				original,
				fixed: result.text,
				logs: result.logs,
			});
		}
	}

	return fixes;
}

export function shouldSkipFile(
	file: TFile,
	settings: MermaidFixerSettings,
	configDir?: string,
): boolean {
	if (file.stat.size > settings.maxFileSizeKb * 1024) {
		return true;
	}

	const normalizedPath = file.path.replace(/\\/g, '/');
	const skipDirs = configDir ? [...settings.skipDirs, configDir] : settings.skipDirs;
	return skipDirs.some((skipDir) =>
		pathMatchesSkipDir(normalizedPath, skipDir),
	);
}

function pathMatchesSkipDir(filePath: string, skipDir: string): boolean {
	const normalizedSkip = skipDir
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+|\/+$/g, '');
	if (normalizedSkip.length === 0) {
		return false;
	}

	const segments = filePath.split('/');
	return (
		segments.includes(normalizedSkip) ||
		filePath === normalizedSkip ||
		filePath.startsWith(`${normalizedSkip}/`)
	);
}
