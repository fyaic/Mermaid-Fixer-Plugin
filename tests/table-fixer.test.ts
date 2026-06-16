import { describe, expect, it } from 'vitest';
import { fixMarkdownTables, splitTableCells } from '../src/table-fixer';

function expectIdempotent(input: string) {
	const first = fixMarkdownTables(input);
	const second = fixMarkdownTables(first.text);
	expect(second).toEqual({
		text: first.text,
		logs: [],
		changed: false,
	});
	return first;
}

describe('splitTableCells', () => {
	it('preserves escaped pipes and inline code pipes', () => {
		expect(splitTableCells('| A \\| B | `C | D` | E |')).toEqual([
			'A \\| B',
			'`C | D`',
			'E',
		]);
	});
});

describe('fixMarkdownTables', () => {
	it('leaves a valid table unchanged', () => {
		const input = ['| A | B |', '| :--- | :--- |', '| 1 | 2 |'].join(
			'\n',
		);

		expect(fixMarkdownTables(input)).toEqual({
			text: input,
			logs: [],
			changed: false,
		});
	});

	it('normalizes separator rows', () => {
		const input = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n');
		const result = expectIdempotent(input);

		expect(result).toEqual({
			text: ['| A | B |', '| :--- | :--- |', '| 1 | 2 |'].join('\n'),
			logs: ['table_separator x1'],
			changed: true,
		});
	});

	it('removes blank lines inside clear table blocks', () => {
		const input = [
			'| A | B |',
			'| :--- | :--- |',
			'| 1 | 2 |',
			'',
			'| 3 | 4 |',
		].join('\n');
		const result = expectIdempotent(input);

		expect(result).toEqual({
			text: [
				'| A | B |',
				'| :--- | :--- |',
				'| 1 | 2 |',
				'| 3 | 4 |',
			].join('\n'),
			logs: ['table_blank_line x1'],
			changed: true,
		});
	});

	it('repairs collapsed one-line tables when the width is unambiguous', () => {
		const input =
			'| Plan | Success | Time | :--- | :--- | :--- | A | 95% | 30 min | B | 85% | 15 min |';
		const result = expectIdempotent(input);

		expect(result).toEqual({
			text: [
				'| Plan | Success | Time |',
				'| :--- | :--- | :--- |',
				'| A | 95% | 30 min |',
				'| B | 85% | 15 min |',
			].join('\n'),
			logs: ['table_collapsed x1'],
			changed: true,
		});
	});

	it('repairs separator continuation without a leading pipe', () => {
		const input = [
			'| Channel | Action | Note |',
			':---|:---|:---| Alipay | Buy | Remark |',
		].join('\n');
		const result = expectIdempotent(input);

		expect(result).toEqual({
			text: [
				'| Channel | Action | Note |',
				'| :--- | :--- | :--- |',
				'| Alipay | Buy | Remark |',
			].join('\n'),
			logs: ['table_collapsed x1'],
			changed: true,
		});
	});

	it('pads short rows when the table column count is clear', () => {
		const input = ['| A | B | C |', '| :--- | :--- | :--- |', '| 1 | 2 |'].join(
			'\n',
		);
		const result = expectIdempotent(input);

		expect(result).toEqual({
			text: ['| A | B | C |', '| :--- | :--- | :--- |', '| 1 | 2 | |'].join(
				'\n',
			),
			logs: ['table_column_padding x1'],
			changed: true,
		});
	});

	it('leaves ambiguous long rows unchanged', () => {
		const input = [
			'| A | B |',
			'| :--- | :--- |',
			'| 1 | 2 | 3 |',
		].join('\n');

		expect(fixMarkdownTables(input)).toEqual({
			text: input,
			logs: [],
			changed: false,
		});
	});

	it('does not modify fenced code blocks', () => {
		const input = [
			'```text',
			'| A | B |',
			'| --- | --- |',
			'```',
			'',
			'| A | B |',
			'| --- | --- |',
		].join('\n');
		const result = expectIdempotent(input);

		expect(result.text).toBe(
			[
				'```text',
				'| A | B |',
				'| --- | --- |',
				'```',
				'',
				'| A | B |',
				'| :--- | :--- |',
			].join('\n'),
		);
		expect(result.logs).toEqual(['table_separator x1']);
	});

	it('can disable all table repairs with the master toggle', () => {
		const input = ['| A | B |', '| --- | --- |'].join('\n');

		expect(fixMarkdownTables(input, { enabled: false })).toEqual({
			text: input,
			logs: [],
			changed: false,
		});
	});
});
