import { J2hfPlugin, VideoConfig, PluginContext, ElementRenderer } from './types.js';

export class PluginRegistry {
  private plugins: J2hfPlugin[] = [];
  private elementRenderers: Record<string, ElementRenderer> = {};

  register(plugin: J2hfPlugin) {
    this.plugins.push(plugin);
    if (plugin.registerElements) {
      const elements = plugin.registerElements();
      for (const [type, renderer] of Object.entries(elements)) {
        this.elementRenderers[type] = renderer;
      }
    }
  }

  async runBeforeGenerate(config: VideoConfig): Promise<VideoConfig> {
    let currentConfig = { ...config };
    for (const plugin of this.plugins) {
      if (plugin.beforeGenerate) {
        currentConfig = await plugin.beforeGenerate(currentConfig);
      }
    }
    return currentConfig;
  }

  async runAfterGenerate(ctx: PluginContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.afterGenerate) {
        await plugin.afterGenerate(ctx);
      }
    }
  }

  getRenderer(type: string): ElementRenderer | undefined {
    return this.elementRenderers[type];
  }
}

// Global default registry instance
export const globalRegistry = new PluginRegistry();
