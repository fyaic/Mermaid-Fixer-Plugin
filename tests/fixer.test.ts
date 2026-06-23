import { describe, expect, it } from 'vitest';
import {
	detectIssues,
	fixFlowchartDiamondGt,
	fixC4Keywords,
	fixMermaidBlocks,
	fixNestedQuotes,
	fixNodeTextParens,
	fixSequenceMultiline,
	fixStateLabels,
	fixStyleComments,
	fixSubgraphTitles,
	fixUnquotedAmpersand,
} from '../src/fixer';

describe('detectIssues', () => {
	it('detects all supported issue keys', () => {
		const block = [
			'flowchart LR',
			'Types --> C4Context[C4Context / C4Container]',
			'sequenceDiagram',
			'Alice->>:',
			'  second line',
			')',
			'stateDiagram-v2',
			'A --> B: value > 10',
			'graph TD',
			'A{score > 10} --> B',
			'B[Hello (world)] --> C',
			'C[Tom & Jerry] --> D',
			'style D fill:#fff,stroke:#333  %% white',
			'E["bad "quote" label"] --> F',
			'subgraph My Group',
			'D-->E',
			'end',
		].join('\n');

		expect(detectIssues(block)).toEqual([
			'seq_multiline',
			'state_label',
			'diamond_gt',
			'paren_conflict',
			'subgraph_space',
			'unquoted_amp',
			'style_comment',
			'nested_quote',
			'c4_keyword',
		]);
	});
});

describe('individual fixes', () => {
	it('collapses sequence multiline messages like the Python version', () => {
		const input = 'sequenceDiagram\nAlice->>Bob: first line\n  second line\n  third line\n)';
		expect(fixSequenceMultiline(input)).toEqual([
			'sequenceDiagram\nAlice->>Bob: first line second line third line )',
			1,
		]);
	});

	it('leaves already single-line sequence messages unchanged', () => {
		const input = 'sequenceDiagram\nAlice->>Bob: first line';
		expect(fixSequenceMultiline(input)).toEqual([input, 0]);
	});

	it('quotes state labels containing special characters', () => {
		const input = 'stateDiagram-v2\nA --> B: value > 10';
		expect(fixStateLabels(input)).toEqual([
			'stateDiagram-v2\nA --> B: "value > 10"',
			1,
		]);
	});

	it('leaves already quoted state labels unchanged', () => {
		const input = 'stateDiagram-v2\nA --> B: "value > 10"';
		expect(fixStateLabels(input)).toEqual([input, 0]);
	});

	it('quotes diamond node text containing greater-than signs', () => {
		const input = 'graph TD\nA{score > 10} --> B';
		expect(fixFlowchartDiamondGt(input)).toEqual([
			'graph TD\nA{"score > 10"} --> B',
			1,
		]);
	});

	it('leaves diamond node text without greater-than signs unchanged', () => {
		const input = 'graph TD\nA{score ok} --> B';
		expect(fixFlowchartDiamondGt(input)).toEqual([input, 0]);
	});

	it('quotes square node text containing parentheses', () => {
		const input = 'graph TD\nA[Hello (world)] --> B';
		expect(fixNodeTextParens(input)).toEqual([
			'graph TD\nA["Hello (world)"] --> B',
			1,
		]);
	});

	it('leaves quoted Mermaid syntax examples unchanged', () => {
		const input = 'graph TD\nNodes --> Db["id[(label)]"]\nNodes --> Labels["Nodes & Shapes"]';
		expect(fixNodeTextParens(input)).toEqual([input, 0]);
		expect(fixUnquotedAmpersand(input)).toEqual([input, 0]);
	});

	it('quotes curly node text containing square brackets without crashing', () => {
		const input = 'graph TD\nA{Has [brackets]} --> B';
		expect(fixNodeTextParens(input)).toEqual([
			'graph TD\nA{"Has [brackets]"} --> B',
			1,
		]);
	});

	it('quotes subgraph titles with spaces', () => {
		const input = 'graph TD\nsubgraph My Group\nA-->B\nend';
		expect(fixSubgraphTitles(input)).toEqual([
			'graph TD\nsubgraph "My Group"\nA-->B\nend',
			1,
		]);
	});

	it('leaves single-token subgraph titles unchanged', () => {
		const input = 'graph TD\nsubgraph Group\nA-->B\nend';
		expect(fixSubgraphTitles(input)).toEqual([input, 0]);
	});

	it('leaves subgraph id plus quoted title syntax unchanged', () => {
		const input = 'graph TD\nsubgraph SIBLINGS ["Parallel Syntaxes & Alternatives"]\nA-->B\nend';
		expect(fixSubgraphTitles(input)).toEqual([input, 0]);
	});

	it('quotes node text containing unquoted ampersands', () => {
		const input = 'graph TD\nA[Tom & Jerry] --> B';
		expect(fixUnquotedAmpersand(input)).toEqual([
			'graph TD\nA["Tom & Jerry"] --> B',
			1,
		]);
	});

	it('leaves already quoted ampersand text unchanged', () => {
		const input = 'graph TD\nA["Tom & Jerry"] --> B';
		expect(fixUnquotedAmpersand(input)).toEqual([input, 0]);
	});

	it('moves inline comments off Mermaid style lines', () => {
		const input = 'graph TD\nstyle A fill:#fff,stroke:#333  %% white\nstyle B fill:#eee,stroke:#333\t%% gray';
		expect(fixStyleComments(input)).toEqual([
			'graph TD\nstyle A fill:#fff,stroke:#333\n%% white\nstyle B fill:#eee,stroke:#333\n%% gray',
			2,
		]);
	});

	it('repairs nested double quotes inside subgraph titles and labels', () => {
		const input = [
			'graph TD',
			'subgraph "SIBLINGS ["Parallel Syntaxes & Alternatives"]"',
			'Db[""id[(label)"]"]',
			'end',
		].join('\n');

		expect(fixNestedQuotes(input)).toEqual([
			[
				'graph TD',
				'subgraph "SIBLINGS [\'Parallel Syntaxes & Alternatives\']"',
				'Db["\'id[(label)\']"]',
				'end',
			].join('\n'),
			2,
		]);
	});

	it('avoids C4 diagram keyword misdetection inside flowcharts', () => {
		const input = 'flowchart TD\nTypes --> C4Context[C4Context / C4Container]';
		expect(fixC4Keywords(input)).toEqual([
			'flowchart TD\nTypes --> C4Ctx[C4Ctx / C4Cont]',
			3,
		]);
	});
});

describe('fixMermaidBlocks', () => {
	it('fixes all mermaid blocks and preserves surrounding markdown', () => {
		const input = [
			'Before',
			'```mermaid',
			'graph TD',
			'A[Hello (world)] --> B',
			'subgraph My Group',
			'A{score > 10} --> B',
			'end',
			'```',
			'After',
		].join('\n');

		const result = fixMermaidBlocks(input);

		expect(result).toEqual({
			text: [
				'Before',
				'```mermaid',
				'graph TD',
				'A["Hello (world)"] --> B',
				'subgraph "My Group"',
				'A{"score > 10"} --> B',
				'end',
				'```',
				'After',
			].join('\n'),
			logs: ['diamond_gt x1', 'paren_conflict x1', 'subgraph_space x1'],
			changed: true,
		});
	});

	it('respects disabled rules', () => {
		const input = [
			'```mermaid',
			'graph TD',
			'A[Hello (world)] --> B',
			'```',
		].join('\n');

		const result = fixMermaidBlocks(input, { parenConflict: false });

		expect(result).toEqual({
			text: input,
			logs: [],
			changed: false,
		});
	});

	it('returns unchanged markdown when no mermaid block exists', () => {
		const input = '# Plain markdown';
		expect(fixMermaidBlocks(input)).toEqual({
			text: input,
			logs: [],
			changed: false,
		});
	});

	it('fixes ecosystem concept-map regressions idempotently', () => {
		const input = [
			'```mermaid',
			'flowchart TD',
			'    subgraph "SIBLINGS ["Parallel Syntaxes & Alternatives"]"',
			'        Types --> C4Context[C4Context / C4Container]',
			'        Nodes --> Db[""id[(label)"]"]',
			'        style Types fill:#fff,stroke:#333  %% white',
			'    end',
			'```',
		].join('\n');

		const first = fixMermaidBlocks(input);
		const second = fixMermaidBlocks(first.text);

		expect(first.logs).toEqual([
			'style_comment x1',
			'nested_quote x2',
			'c4_keyword x3',
		]);
		expect(second).toEqual({
			text: first.text,
			logs: [],
			changed: false,
		});
	});
});
