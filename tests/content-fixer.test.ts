import { describe, expect, it } from 'vitest';
import { fixMarkdownContent } from '../src/content-fixer';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/settings';

describe('fixMarkdownContent', () => {
	it('fixes Mermaid-only documents', () => {
		const input = [
			'```mermaid',
			'graph TD',
			'A[Hello (world)] --> B',
			'```',
		].join('\n');

		const result = fixMarkdownContent(input, DEFAULT_SETTINGS);

		expect(result).toEqual({
			text: [
				'```mermaid',
				'graph TD',
				'A["Hello (world)"] --> B',
				'```',
			].join('\n'),
			logs: ['paren_conflict x1'],
			changed: true,
		});
	});

	it('fixes table-only documents', () => {
		const input = ['| A | B |', '| --- | --- |'].join('\n');

		const result = fixMarkdownContent(input, DEFAULT_SETTINGS);

		expect(result).toEqual({
			text: ['| A | B |', '| :--- | :--- |'].join('\n'),
			logs: ['table_separator x1'],
			changed: true,
		});
	});

	it('fixes mixed Mermaid and table documents', () => {
		const input = [
			'```mermaid',
			'graph TD',
			'A[Hello (world)] --> B',
			'```',
			'',
			'| A | B |',
			'| --- | --- |',
		].join('\n');

		const result = fixMarkdownContent(input, DEFAULT_SETTINGS);

		expect(result.logs).toEqual(['paren_conflict x1', 'table_separator x1']);
		expect(result.changed).toBe(true);
		expect(result.text).toContain('A["Hello (world)"] --> B');
		expect(result.text).toContain('| :--- | :--- |');
	});

	it('returns unchanged result for documents without issues', () => {
		const input = '# Plain markdown';

		expect(fixMarkdownContent(input, DEFAULT_SETTINGS)).toEqual({
			text: input,
			logs: [],
			changed: false,
		});
	});

	it('migrates old settings without table rules', () => {
		const settings = normalizeSettings({
			enabledRules: {
				parenConflict: false,
			},
		});

		expect(settings.enabledRules.parenConflict).toBe(false);
		expect(settings.enabledRules.seqMultiline).toBe(true);
		expect(settings.tableRules.enabled).toBe(true);
		expect(settings.tableRules.collapsedTables).toBe(true);
	});

	it('keeps Mermaid fixes enabled when table fixes are disabled', () => {
		const input = [
			'```mermaid',
			'graph TD',
			'A[Hello (world)] --> B',
			'```',
			'',
			'| A | B |',
			'| --- | --- |',
		].join('\n');
		const settings = normalizeSettings({
			tableRules: { enabled: false },
		});

		const result = fixMarkdownContent(input, settings);

		expect(result.logs).toEqual(['paren_conflict x1']);
		expect(result.text).toContain('A["Hello (world)"] --> B');
		expect(result.text).toContain('| --- | --- |');
	});
});
