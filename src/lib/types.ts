export interface VideoConfig {
  width?: number;
  height?: number;
  fps?: number;
  compositionId?: string;
  architecture?: 'monolithic' | 'modular';
  subCompositions?: {
    scenes?: string[];
  };
  palette?: {
    background?: string;
    foreground?: string;
    accent?: string;
    neutral?: string[];
    themeRef?: string;
  };
  typography?: {
    bodyFont?: string;
    headlineFont?: string;
  };
  variables?: {
    declarations?: Array<{
      id: string;
      type: string;
      default: any;
    }>;
  };
  renderSettings?: {
    output?: string;
    quality?: string;
    fps?: number;
    strict?: boolean;
  };
  [key: string]: any; // Allow extension fields for custom rendering
}

export interface PluginContext {
  config: VideoConfig;
  outputDir: string;
}

export interface ElementRenderer {
  render: (element: any, scene: any) => string;
}

export interface J2hfPlugin {
  name: string;
  /**
   * Hook called immediately after loading configuration.
   * Can validate, inject default values, or fetch dynamic data.
   */
  beforeGenerate?: (config: VideoConfig) => VideoConfig | Promise<VideoConfig>;
  /**
   * Register custom element types.
   * Returns a map of type name to renderer.
   */
  registerElements?: () => Record<string, ElementRenderer>;
  /**
   * Hook called after generation completes.
   */
  afterGenerate?: (ctx: PluginContext) => void | Promise<void>;
}
