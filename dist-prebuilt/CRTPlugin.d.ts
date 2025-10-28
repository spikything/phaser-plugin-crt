import Phaser from "phaser";
import { CRTPipelineOptions } from "./CRTPostFX";
export declare class CRTPlugin extends Phaser.Plugins.ScenePlugin {
    private enabled;
    constructor(scene: Phaser.Scene, pluginManager: Phaser.Plugins.PluginManager, pluginKey: string);
    boot(): void;
    private ensureRegistered;
    private forEachCam;
    private applyOptionsToCameras;
    enable(options?: CRTPipelineOptions): void;
    disable(): void;
    update(options: CRTPipelineOptions): void;
    toggle(options?: CRTPipelineOptions): void;
}
declare global {
    namespace Phaser {
        interface Scene {
            crt: CRTPlugin;
        }
    }
}
