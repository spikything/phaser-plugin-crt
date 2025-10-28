import Phaser from "phaser";
export interface CRTPipelineOptions {
    curvature?: number;
    scanlineIntensity?: number;
    scanlineFreq?: number;
    wobbleAmp?: number;
    wobbleFreq?: number;
    vignette?: number;
    desaturate?: number;
    gamma?: number;
    maskStrength?: number;
    noise?: number;
}
export declare const DEFAULTS: Required<CRTPipelineOptions>;
export declare class CRTPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    private _time;
    private _pendingOptions?;
    private getActiveShader;
    private applyPendingOptions;
    constructor(game: Phaser.Game);
    onBoot(): void;
    onPreRender(): void;
    setOptions(opts: Required<CRTPipelineOptions>): void;
}
