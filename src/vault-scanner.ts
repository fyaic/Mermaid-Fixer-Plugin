import { normalizePath, type App, type TFile } from 'obsidian';
import { fixMarkdownContent, hasMarkdownFixCandidate } from './content-fixer';
import type {
	MermaidFixerSettings,
	PendingFileFix,
	VaultScanProgressCallback,
} from './types';

export async function scanVaultForFixes(
	app: App,
	settings: MermaidFixerSettings,
	onProgress?: VaultScanProgressCallback,
): Promise<PendingFileFix[]> {
	const fixes: PendingFileFix[] = [];
	const files = app.vault.getMarkdownFiles();
	const reportProgress = (scannedFiles: number, currentFile?: string) => {
		onProgress?.({
			scannedFiles,
			totalFiles: files.length,
			issueFiles: fixes.length,
			currentFile,
		});
	};

	reportProgress(0);

	for (let index = 0; index < files.length; index += 1) {
		const file = files[index];
		if (!file) {
			continue;
		}

		try {
			if (shouldSkipFile(file, settings, app.vault.configDir)) {
				continue;
			}

			let original: string;
			try {
				original = await app.vault.read(file);
			} catch {
				continue;
			}

			if (!hasMarkdownFixCandidate(original)) {
				continue;
			}

			const result = fixMarkdownContent(original, settings);
			if (result.changed) {
				fixes.push({
					file,
					original,
					fixed: result.text,
					logs: result.logs,
				});
			}
		} finally {
			reportProgress(index + 1, file.path);
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

	const normalizedPath = normalizePath(file.path);
	const skipDirs = configDir ? [...settings.skipDirs, configDir] : settings.skipDirs;
	return skipDirs.some((skipDir) =>
		pathMatchesSkipDir(normalizedPath, skipDir),
	);
}

function pathMatchesSkipDir(filePath: string, skipDir: string): boolean {
	const normalizedSkip = normalizePath(skipDir.trim()).replace(/^\/+|\/+$/g, '');
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
