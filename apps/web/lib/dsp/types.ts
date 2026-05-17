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

export type GeneratedSample = {
  filename: string;
  sampleRate: number;
  channels: Float32Array[];
  category: SampleCategory;
  description: string;
};

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

export type WorkerRequest = {
  type: "generate";
  files: AudioBufferData[];
  preset: string;
  chaos: number;
  lengthMode?: string;
};

export type WorkerProgress =
  | { type: "progress"; value: number; message: string }
  | { type: "complete"; zipBlob: Blob; manifest: PackManifest }
  | { type: "error"; error: string };
