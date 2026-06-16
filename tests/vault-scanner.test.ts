import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings';
import { scanVaultForFixes } from '../src/vault-scanner';

vi.mock('obsidian', () => ({
	normalizePath: (path: string) => path.replace(/\\/g, '/'),
}));

function makeApp(files: Array<{ path: string; text: string; size?: number }>) {
	const configDir = ['.', 'obsidian'].join('');
	const markdownFiles = files.map((file) => ({
		path: file.path,
		stat: { size: file.size ?? file.text.length },
	}));

	return {
		vault: {
			configDir,
			getMarkdownFiles: () => markdownFiles,
			read: async (file: { path: string }) =>
				files.find((candidate) => candidate.path === file.path)?.text ?? '',
		},
	} as never;
}

describe('scanVaultForFixes', () => {
	it('includes Mermaid-only files', async () => {
		const app = makeApp([
			{
				path: 'mermaid.md',
				text: [
					'```mermaid',
					'graph TD',
					'A[Hello (world)] --> B',
					'```',
				].join('\n'),
			},
		]);

		const fixes = await scanVaultForFixes(app, DEFAULT_SETTINGS);

		expect(fixes).toHaveLength(1);
		expect(fixes[0]?.logs).toEqual(['paren_conflict x1']);
	});

	it('includes table-only files', async () => {
		const app = makeApp([
			{
				path: 'table.md',
				text: ['| A | B |', '| --- | --- |'].join('\n'),
			},
		]);

		const fixes = await scanVaultForFixes(app, DEFAULT_SETTINGS);

		expect(fixes).toHaveLength(1);
		expect(fixes[0]?.logs).toEqual(['table_separator x1']);
	});

	it('skips files with no issues', async () => {
		const app = makeApp([{ path: 'plain.md', text: '# Plain markdown' }]);

		const fixes = await scanVaultForFixes(app, DEFAULT_SETTINGS);

		expect(fixes).toEqual([]);
	});

	it('respects skipped directories and max file size', async () => {
		const skippedDir = ['.', 'git'].join('');
		const app = makeApp([
			{ path: `${skippedDir}/table.md`, text: '| A | B |\n| --- | --- |' },
			{ path: 'large.md', text: '| A | B |\n| --- | --- |', size: 999_999 },
		]);

		const fixes = await scanVaultForFixes(app, {
			...DEFAULT_SETTINGS,
			maxFileSizeKb: 1,
		});

		expect(fixes).toEqual([]);
	});

	it('reports scan progress for each file', async () => {
		const app = makeApp([
			{ path: 'plain.md', text: '# Plain markdown' },
			{ path: 'table.md', text: '| A | B |\n| --- | --- |' },
		]);
		const progress: Array<{
			scannedFiles: number;
			totalFiles: number;
			issueFiles: number;
			currentFile?: string;
		}> = [];

		await scanVaultForFixes(app, DEFAULT_SETTINGS, (next) => {
			progress.push(next);
		});

		expect(progress).toEqual([
			{ scannedFiles: 0, totalFiles: 2, issueFiles: 0 },
			{
				scannedFiles: 1,
				totalFiles: 2,
				issueFiles: 0,
				currentFile: 'plain.md',
			},
			{
				scannedFiles: 2,
				totalFiles: 2,
				issueFiles: 1,
				currentFile: 'table.md',
			},
		]);
	});
});
