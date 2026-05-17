export type AudioBufferData = {
  name: string;
  sampleRate: number;
  channels: Float32Array[];
};

export type SampleCategory =
  | "ambience"
  | "one-shot"
  | "loop"
  | "texture"
  | "oddity"
  | "granular";

export type PackManifest = {
  pack_id: string;
  preset: string;
  chaos: number;
  source_files: string[];
  generated_at: string;
  local_processing: true;
  samples: Array<{
    filename: string;
    category: SampleCategory;
    description: string;
    duration_seconds: number;
    sample_rate: number;
    channels: number;
  }>;
};

export interface Preset {
  id: string;
  name: string;
  description: string;
  tools: string[];
  output_count: number;
  categories: string[];
}

export interface ToolInfo {
  available: boolean;
  version?: string;
}

export interface Capabilities {
  presets: Preset[];
  chaos_levels: { min: number; max: number; step: number };
  output_formats: string[];
  accepted_extensions: string[];
  max_upload_mb: number;
  max_duration_seconds: number;
  tools: Record<
    string,
    ToolInfo | { available: boolean; engines?: Record<string, ToolInfo> }
  >;
}


