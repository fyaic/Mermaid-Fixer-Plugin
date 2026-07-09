import { App, PluginSettingTab, Setting } from 'obsidian';
import type MermaidFixerPlugin from './main';
import type { EnabledRules, TableRuleKey } from './types';

const RULE_SETTINGS: Array<{
	key: keyof EnabledRules;
	name: string;
	desc: string;
}> = [
	{
		key: 'seqMultiline',
		name: 'Enable sequence multiline fix',
		desc: 'Collapse accidental multiline sequence messages into one line.',
	},
	{
		key: 'stateLabel',
		name: 'Enable state label fix',
		desc: 'Quote state transition labels containing > or +.',
	},
	{
		key: 'diamondGt',
		name: 'Enable diamond node fix',
		desc: 'Quote diamond node text containing >.',
	},
	{
		key: 'parenConflict',
		name: 'Enable parenthesis conflict fix',
		desc: 'Quote node text when shape delimiters conflict with text brackets.',
	},
	{
		key: 'subgraphSpace',
		name: 'Enable subgraph title fix',
		desc: 'Quote subgraph titles that contain spaces.',
	},
	{
		key: 'unquotedAmp',
		name: 'Enable unquoted ampersand fix',
		desc: 'Quote node text containing unquoted ampersands.',
	},
	{
		key: 'styleComment',
		name: 'Enable style comment fix',
		desc: 'Move inline comments off Mermaid style lines.',
	},
	{
		key: 'singlePercentComment',
		name: 'Enable single percent comment fix',
		desc: 'Convert Mermaid lines starting with a single % into %% comments.',
	},
	{
		key: 'nestedQuote',
		name: 'Enable nested quote fix',
		desc: 'Replace nested double quotes inside Mermaid titles and labels.',
	},
	{
		key: 'c4Keyword',
		name: 'Enable C4 keyword fix',
		desc: 'Avoid C4 keyword misdetection inside flowcharts.',
	},
	{
		key: 'edgeLabelSpecial',
		name: 'Enable edge label special character fix',
		desc: 'Quote flowchart edge labels containing syntax-significant characters.',
	},
	{
		key: 'xychartSyntax',
		name: 'Enable XY chart syntax fix',
		desc: 'Quote XY chart titles and normalize labeled line or bar series.',
	},
	{
		key: 'quadrantMissingType',
		name: 'Enable quadrant chart type fix',
		desc: 'Insert quadrantChart when a quadrant diagram body is missing its type line.',
	},
	{
		key: 'quadrantText',
		name: 'Enable quadrant chart text fix',
		desc: 'Quote quadrant chart axis and quadrant labels when Mermaid cannot parse them.',
	},
];

const TABLE_RULE_SETTINGS: Array<{
	key: TableRuleKey;
	name: string;
	desc: string;
}> = [
	{
		key: 'collapsedTables',
		name: 'Fix collapsed one-line tables',
		desc: 'Split safe one-line table sequences into renderable Markdown table rows.',
	},
	{
		key: 'separatorNormalization',
		name: 'Normalize table separators',
		desc: 'Convert table separator cells to left-aligned :--- markers.',
	},
	{
		key: 'blankLineCleanup',
		name: 'Remove blank lines inside tables',
		desc: 'Remove blank lines only when adjacent rows clearly belong to the same table.',
	},
	{
		key: 'columnPadding',
		name: 'Pad short table rows',
		desc: 'Add empty cells to short rows when the table column count is clear.',
	},
];

export class MermaidFixerSettingTab extends PluginSettingTab {
	plugin: MermaidFixerPlugin;

	constructor(app: App, plugin: MermaidFixerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Mermaid fixes').setHeading();
		for (const rule of RULE_SETTINGS) {
			new Setting(containerEl)
				.setName(rule.name)
				.setDesc(rule.desc)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.enabledRules[rule.key])
						.onChange(async (value) => {
							this.plugin.settings.enabledRules[rule.key] = value;
							await this.plugin.saveSettings();
						}),
				);
		}

		new Setting(containerEl).setName('Markdown table fixes').setHeading();
		new Setting(containerEl)
			.setName('Enable Markdown table fixes')
			.setDesc('Repair common Markdown table syntax issues in the same commands.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tableRules.enabled)
					.onChange(async (value) => {
						this.plugin.settings.tableRules.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		for (const rule of TABLE_RULE_SETTINGS) {
			new Setting(containerEl)
				.setName(rule.name)
				.setDesc(rule.desc)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.tableRules[rule.key])
						.onChange(async (value) => {
							this.plugin.settings.tableRules[rule.key] = value;
							await this.plugin.saveSettings();
						}),
				);
		}

		new Setting(containerEl).setName('Behavior').setHeading();
		new Setting(containerEl)
			.setName('Show diff before applying changes')
			.setDesc('Preview all proposed edits before modifying notes.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showDiffBeforeApply)
					.onChange(async (value) => {
						this.plugin.settings.showDiffBeforeApply = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Max file size (kb)')
			.setDesc('Skip Markdown files larger than this threshold during vault scans.')
			.addText((text) =>
				text
					.setPlaceholder('500')
					.setValue(String(this.plugin.settings.maxFileSizeKb))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (Number.isFinite(parsed) && parsed > 0) {
							this.plugin.settings.maxFileSizeKb = parsed;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl).setName('Vault scan').setHeading();
		new Setting(containerEl)
			.setName('Skip directories')
			.setDesc('One directory name or vault-relative path per line.')
			.addTextArea((text) => {
				text.inputEl.rows = 5;
				text
					.setPlaceholder('.git\nnode_modules')
					.setValue(this.plugin.settings.skipDirs.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.skipDirs = value
							.split(/\r?\n/)
							.map((line) => line.trim())
							.filter((line) => line.length > 0);
						await this.plugin.saveSettings();
					});
			});
	}
}
