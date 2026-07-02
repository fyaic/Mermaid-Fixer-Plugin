import { describe, expect, it } from 'vitest';
import {
	detectIssues,
	fixFlowchartDiamondGt,
	fixC4Keywords,
	fixFlowchartEdgeLabels,
	fixMissingQuadrantChartType,
	hasMermaidFixCandidate,
	fixMermaidBlocks,
	fixNestedQuotes,
	fixNodeTextParens,
	fixSequenceMultiline,
	fixSinglePercentComments,
	fixStateLabels,
	fixStyleComments,
	fixSubgraphTitles,
	fixUnquotedAmpersand,
	fixXychartSyntax,
} from '../src/fixer';

describe('detectIssues', () => {
	it('detects supported mixed flowchart and UML issue keys', () => {
		const block = [
			'flowchart LR',
			'Types --> C4Context[C4Context / C4Container]',
			'Products -->|POST /v1/products/{key}/billing/*| Billing',
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
			'% invalid single-percent comment',
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
			'single_percent_comment',
			'nested_quote',
			'c4_keyword',
			'edge_label_special',
		]);
	});

	it('recognizes current Mermaid diagram starters as bare documents', () => {
		const starters = [
			'flowchart TD',
			'graph LR',
			'sequenceDiagram',
			'classDiagram',
			'classDiagram-v2',
			'stateDiagram',
			'stateDiagram-v2',
			'erDiagram',
			'journey',
			'gantt',
			'pie',
			'mindmap',
			'timeline',
			'gitGraph',
			'C4Context',
			'C4Container',
			'C4Component',
			'C4Dynamic',
			'C4Deployment',
			'quadrantChart',
			'requirementDiagram',
			'xychart',
			'xychart-beta',
			'sankey-beta',
			'block-beta',
			'packet-beta',
			'architecture-beta',
			'radar-beta',
			'kanban',
			'treemap-beta',
			'info',
		];

		for (const starter of starters) {
			expect(hasMermaidFixCandidate(`${starter}\n`)).toBe(true);
		}
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

	it('repairs quoted subgraph id-title shorthand', () => {
		const input = 'flowchart TB\nsubgraph "SH[SynapseHub 控制面 · identity.fuyonder.tech]"\nA-->B\nend';
		expect(detectIssues(input)).toContain('subgraph_space');
		expect(fixSubgraphTitles(input)).toEqual([
			'flowchart TB\nsubgraph SH ["SynapseHub 控制面 · identity.fuyonder.tech"]\nA-->B\nend',
			1,
		]);
	});

	it('normalizes compact quoted subgraph id-title syntax', () => {
		const input = 'flowchart TB\nsubgraph SH["\'SynapseHub 控制面 · identity.fuyonder.tech\'"]\nA-->B\nend';
		expect(detectIssues(input)).toContain('subgraph_space');
		expect(fixSubgraphTitles(input)).toEqual([
			'flowchart TB\nsubgraph SH ["SynapseHub 控制面 · identity.fuyonder.tech"]\nA-->B\nend',
			1,
		]);
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

	it('converts single percent Mermaid comment lines', () => {
		const input = [
			'flowchart LR',
			'% broken comment',
			'%% already valid',
			'%%{init: {"theme":"base"}}%%',
			'A-->B',
		].join('\n');

		expect(detectIssues(input)).toContain('single_percent_comment');
		expect(fixSinglePercentComments(input)).toEqual([
			[
				'flowchart LR',
				'%% broken comment',
				'%% already valid',
				'%%{init: {"theme":"base"}}%%',
				'A-->B',
			].join('\n'),
			1,
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

	it('quotes flowchart edge labels with syntax-significant characters', () => {
		const input = [
			'flowchart TD',
			'Products -->|POST /v1/products/{key}/billing/*| Billing',
			'Products -->|"GET /v1/products/{key}"| ProductContext',
			'User -->|登录/注册| Auth0',
		].join('\n');

		expect(detectIssues(input)).toContain('edge_label_special');
		expect(fixFlowchartEdgeLabels(input)).toEqual([
			[
				'flowchart TD',
				'Products -->|"POST /v1/products/{key}/billing/*"| Billing',
				'Products -->|"GET /v1/products/{key}"| ProductContext',
				'User -->|登录/注册| Auth0',
			].join('\n'),
			1,
		]);
	});

	it('normalizes XY chart syntax to Mermaid 11 form', () => {
		const input = [
			'xychart-beta',
			'    title 计算资源增长计划 vs 实际需求',
			'    x-axis [2026 Q1, 2026 Q2, 2026 Q3, 2026 Q4]',
			'    y-axis "资源倍数 (对数刻度)" 1 --> 100',
			'    line [理性规划 10倍/年] 1.78, 3.16, 5.62, 10',
			'    line [实际需求 3倍/季] 3, 9, 27, 81',
			'    line [供需缺口] 1.22, 5.84, 21.38, 71',
		].join('\n');

		expect(detectIssues(input)).toContain('xychart_syntax');
		expect(fixXychartSyntax(input)).toEqual([
			[
				'xychart-beta',
				'    title "计算资源增长计划 vs 实际需求"',
				'    x-axis ["2026 Q1", "2026 Q2", "2026 Q3", "2026 Q4"]',
				'    y-axis "资源倍数 (对数刻度)" 1 --> 100',
				'    line "理性规划 10倍/年" [1.78, 3.16, 5.62, 10]',
				'    line "实际需求 3倍/季" [3, 9, 27, 81]',
				'    line "供需缺口" [1.22, 5.84, 21.38, 71]',
			].join('\n'),
			5,
		]);
	});

	it('inserts missing quadrantChart diagram type', () => {
		const input = [
			'',
			'    title 军事合作伦理决策框架',
			'    x-axis 低防御价值 --> 高防御价值',
			'    y-axis 低伦理风险 --> 高伦理风险',
			'    quadrant-1 有条件合作区',
			'    quadrant-2 拒绝合作区',
		].join('\n');

		expect(detectIssues(input)).toContain('quadrant_missing_type');
		expect(fixMissingQuadrantChartType(input)).toEqual([
			[
				'',
				'quadrantChart',
				'    title 军事合作伦理决策框架',
				'    x-axis 低防御价值 --> 高防御价值',
				'    y-axis 低伦理风险 --> 高伦理风险',
				'    quadrant-1 有条件合作区',
				'    quadrant-2 拒绝合作区',
			].join('\n'),
			1,
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

	it('wraps and repairs bare Mermaid documents', () => {
		const input = [
			'flowchart TB',
			'  subgraph "SH[SynapseHub 控制面 · identity.fuyonder.tech]"',
			'    A-->B',
			'    Products -->|POST /v1/products/{key}/billing/*| Billing',
			'  end',
		].join('\n');

		expect(hasMermaidFixCandidate(input)).toBe(true);
		expect(fixMermaidBlocks(input)).toEqual({
			text: [
				'```mermaid',
				'flowchart TB',
				'  subgraph SH ["SynapseHub 控制面 · identity.fuyonder.tech"]',
				'    A-->B',
				'    Products -->|"POST /v1/products/{key}/billing/*"| Billing',
				'  end',
				'```',
			].join('\n'),
			logs: ['bare_mermaid x1', 'subgraph_space x1', 'edge_label_special x1'],
			changed: true,
		});
	});

	it('repairs CRLF and tilde fenced Mermaid blocks', () => {
		const input = '~'.repeat(3) + 'mermaid\r\nflowchart TD\r\nA[Hello (world)] --> B\r\n' + '~'.repeat(3);
		expect(fixMermaidBlocks(input)).toEqual({
			text: ['~~~mermaid', 'flowchart TD', 'A["Hello (world)"] --> B', '~~~'].join('\n'),
			logs: ['paren_conflict x1'],
			changed: true,
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

	it('fixes Anthropic interview XY and quadrant regressions idempotently', () => {
		const input = [
			'```mermaid',
			'xychart-beta',
			'    title 计算资源增长计划 vs 实际需求',
			'    x-axis [2026 Q1, 2026 Q2, 2026 Q3, 2026 Q4]',
			'    y-axis "资源倍数 (对数刻度)" 1 --> 100',
			'    line [理性规划 10倍/年] 1.78, 3.16, 5.62, 10',
			'    line [实际需求 3倍/季] 3, 9, 27, 81',
			'    line [供需缺口] 1.22, 5.84, 21.38, 71',
			'```',
			'```mermaid',
			'',
			'    title 军事合作伦理决策框架',
			'    x-axis 低防御价值 --> 高防御价值',
			'    y-axis 低伦理风险 --> 高伦理风险',
			'    quadrant-1 有条件合作区',
			'    quadrant-2 拒绝合作区',
			'```',
		].join('\n');

		const first = fixMermaidBlocks(input);
		const second = fixMermaidBlocks(first.text);

		expect(first.logs).toEqual(['xychart_syntax x5', 'quadrant_missing_type x1']);
		expect(first.text).toContain('title "计算资源增长计划 vs 实际需求"');
		expect(first.text).toContain('line "理性规划 10倍/年" [1.78, 3.16, 5.62, 10]');
		expect(first.text).toContain('quadrantChart');
		expect(second).toEqual({
			text: first.text,
			logs: [],
			changed: false,
		});
	});
});
