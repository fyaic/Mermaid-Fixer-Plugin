import { Plugin } from 'obsidian';
import { registerCommands } from './commands';
import { MermaidFixerSettingTab } from './setting-tab';
import { normalizeSettings } from './settings';
import type { MermaidFixerSettings } from './types';

export default class MermaidFixerPlugin extends Plugin {
	settings!: MermaidFixerSettings;

	async onload() {
		await this.loadSettings();
		registerCommands(this);
		this.addSettingTab(new MermaidFixerSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = normalizeSettings(
			(await this.loadData()) as Partial<MermaidFixerSettings> | null,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
