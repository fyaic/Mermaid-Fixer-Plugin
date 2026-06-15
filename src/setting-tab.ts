import { App, PluginSettingTab, Setting } from 'obsidian';
import type MermaidFixerPlugin from './main';
import type { EnabledRules } from './types';

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

		new Setting(containerEl).setName('Fix rules').setHeading();
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
