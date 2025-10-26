import Phaser from "phaser";
import { CRTPostFX, CRTPipelineOptions, DEFAULTS } from "./CRTPostFX";

function isWebGL(
  scene: Phaser.Scene | null | undefined
): scene is Phaser.Scene {
  if (!scene) return false;

  const renderer = scene.game.renderer as
    | Phaser.Renderer.WebGL.WebGLRenderer
    | Phaser.Renderer.Canvas.CanvasRenderer
    | undefined;

  if (renderer && (renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl) {
    return true;
  }

  const type = (renderer as { type?: number } | undefined)?.type;
  return type === Phaser.WEBGL;
}

function normalize(opts?: CRTPipelineOptions): Required<CRTPipelineOptions> {
  return { ...DEFAULTS, ...(opts || {}) };
}

export class CRTPlugin extends Phaser.Plugins.ScenePlugin {
  private enabled = false;

  constructor(
    scene: Phaser.Scene,
    pluginManager: Phaser.Plugins.PluginManager,
    pluginKey: string
  ) {
    super(scene, pluginManager, pluginKey);
  }

  boot() {
    const systems = this.systems;
    if (!systems) return;

    const events = systems.events;
    events.on(Phaser.Scenes.Events.SHUTDOWN, this.disable, this);
    events.on(Phaser.Scenes.Events.DESTROY, this.disable, this);
  }

  private ensureRegistered(scene: Phaser.Scene) {
    const name = "CRTPostFX";
    // @ts-ignore private-ish registries differ by Phaser versions
    const reg = (scene.game.renderer as any)?.pipelines;
    const already =
      reg?._postPipelineClasses?.[name] || reg?.postFX?.pipelines?.[name];

    if (!already) {
      const renderer = scene.renderer;
      if (renderer && "pipelines" in renderer) {
        (
          renderer as Phaser.Renderer.WebGL.WebGLRenderer
        ).pipelines.addPostPipeline(name, CRTPostFX);
      }
    }
  }

  private forEachCam(
    scene: Phaser.Scene,
    fn: (cam: Phaser.Cameras.Scene2D.Camera) => void
  ) {
    scene.cameras?.cameras.forEach(fn);
  }

  private applyOptionsToCameras(
    scene: Phaser.Scene,
    opts: Required<CRTPipelineOptions>
  ) {
    this.forEachCam(scene, (cam) => {
      const instances = cam.getPostPipeline("CRTPostFX") as unknown;
      const arr = Array.isArray(instances)
        ? instances
        : instances
        ? [instances]
        : [];
      (arr as CRTPostFX[]).forEach((p) => p.setOptions(opts));
    });
  }

  enable(options?: CRTPipelineOptions) {
    const scene = this.scene;
    if (!isWebGL(scene)) return;

    this.ensureRegistered(scene);

    this.forEachCam(scene, (cam) => cam.setPostPipeline("CRTPostFX"));
    this.applyOptionsToCameras(scene, normalize(options));
    this.enabled = true;

    scene.scale?.on("resize", () => {
      this.applyOptionsToCameras(scene, normalize(options));
    });
  }

  disable() {
    const scene = this.scene;
    if (!isWebGL(scene)) return;

    this.forEachCam(scene, (cam) => {
      try {
        cam.removePostPipeline("CRTPostFX");
      } catch {}
    });
    this.enabled = false;
  }

  update(options: CRTPipelineOptions) {
    const scene = this.scene;
    if (!isWebGL(scene)) return;

    this.applyOptionsToCameras(scene, normalize(options));
  }

  toggle(options?: CRTPipelineOptions) {
    if (this.enabled) this.disable();
    else this.enable(options);
  }
}

// Optional convenience namespace for typing on scene.crt
declare global {
  namespace Phaser {
    interface Scene {
      crt: CRTPlugin;
    }
  }
}
