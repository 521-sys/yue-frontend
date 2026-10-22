import type { DubbingCue } from "../lib/dubbing-timeline";

export interface DubbingMaterialPart {
  id: string;
  label: string;
  title: string;
  videoSrc: string;
  cues: DubbingCue[];
}

export interface DubbingMaterial {
  id: string;
  title: string;
  difficulty: string;
  tags: string[];
  sourceLabel: string;
  sourceUrl: string;
  licenseLabel: string;
  licenseUrl: string;
  parts: DubbingMaterialPart[];
}
