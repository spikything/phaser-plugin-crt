import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import Module from "node:module";
import path from "node:path";

const TEST_DEFAULTS = {
  curvature: 0.15,
  scanlineIntensity: 0.15,
  scanlineFreq: 1.9,
  wobbleAmp: 0.0008,
  wobbleFreq: 40.0,
  vignette: 0.25,
  desaturate: 0.08,
  gamma: 1.05,
  maskStrength: 0.04,
} as const;

type Spy = ((...args: any[]) => any) & {
  calls: any[][];
  results: any[];
  callCount(): number;
  reset(): void;
};

function createSpy(impl?: (...args: any[]) => any): Spy {
  const calls: any[][] = [];
  const results: any[] = [];
  const spy = ((...args: any[]) => {
    calls.push(args);
    const result = impl ? impl(...args) : undefined;
    results.push(result);
    return result;
  }) as Spy;
  spy.calls = calls;
  spy.results = results;
  spy.callCount = () => calls.length;
  spy.reset = () => {
    calls.length = 0;
    results.length = 0;
  };
  return spy;
}

class StubScenePlugin {
  public scene: any;
  public systems: any;

  constructor(scene: any) {
    this.scene = scene;
    this.systems = scene?.sys;
  }
}

class StubPostFXPipeline {}

class StubCanvasRenderer {}

class StubWebGLRenderer {}

class StubCRTPostFX extends StubPostFXPipeline {
  static instances: StubCRTPostFX[] = [];
  public setOptions: Spy;

  constructor(_game: any) {
    super();
    this.setOptions = createSpy();
    StubCRTPostFX.instances.push(this);
  }

  static reset() {
    this.instances.length = 0;
  }
}

const phaserObject = {
  WEBGL: 1,
  Scenes: { Events: { SHUTDOWN: "shutdown", DESTROY: "destroy" } },
  Plugins: { ScenePlugin: StubScenePlugin },
  Renderer: {
    WebGL: { WebGLRenderer: StubWebGLRenderer, Pipelines: { PostFXPipeline: StubPostFXPipeline } },
    Canvas: { CanvasRenderer: StubCanvasRenderer },
  },
  Cameras: { Scene2D: { Camera: class {} } },
};

const phaserModuleExports = Object.assign({ default: phaserObject }, phaserObject);

const CRT_PLUGIN_PATH = path.resolve(__dirname, "../src/CRTPlugin.js");
const CRT_POST_FX_PATH = path.resolve(__dirname, "../src/CRTPostFX.js");

function loadCRTPlugin(): typeof import("../src/CRTPlugin").CRTPlugin {
  const ModuleCtor = (Module as unknown as { Module: any }).Module;
  const originalLoad = ModuleCtor._load;
  ModuleCtor._load = function (request: string, parent: any, isMain: boolean) {
    if (request === "phaser") {
      return phaserModuleExports;
    }
    const parentFile = parent?.filename;
    if (
      request === CRT_POST_FX_PATH ||
      (request === "./CRTPostFX" && parentFile === CRT_PLUGIN_PATH)
    ) {
      return { CRTPostFX: StubCRTPostFX, DEFAULTS: TEST_DEFAULTS };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[CRT_PLUGIN_PATH];
    delete require.cache[CRT_POST_FX_PATH];
    try {
      const phaserPath = require.resolve("phaser");
      delete require.cache[phaserPath];
    } catch {}

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(CRT_PLUGIN_PATH).CRTPlugin;
  } finally {
    ModuleCtor._load = originalLoad;
  }
}

function createScene(webgl = true) {
  const registry: Record<string, any> = {};
  const pipelines = {
    addPostPipeline: createSpy((name: string, klass: any) => {
      registry[name] = klass;
    }),
    _postPipelineClasses: registry as Record<string, any>,
    postFX: { pipelines: registry as Record<string, any> },
  };

  const renderer: any = { pipelines };
  if (webgl) {
    renderer.gl = {};
  } else {
    renderer.type = 0;
  }

  const game = { renderer };
  const scaleHandlers: Record<string, (...args: any[]) => void> = {};
  const scale = {
    on: createSpy((event: string, cb: (...args: any[]) => void) => {
      scaleHandlers[event] = cb;
      return scale;
    }),
  };

  const cameraInstances: StubCRTPostFX[] = [];
  const camera = {
    setPostPipeline: createSpy(() => {
      const Klass = registry["CRTPostFX"];
      if (typeof Klass === "function") {
        const instance = new Klass(game);
        cameraInstances.push(instance);
      }
    }),
    getPostPipeline: createSpy(() => cameraInstances),
    removePostPipeline: createSpy(() => {
      cameraInstances.length = 0;
    }),
  };

  const cameras = { cameras: [camera] };
  const events = { on: createSpy() };
  const systems = { events };

  const scene: any = {
    game,
    renderer,
    scale,
    cameras,
    sys: systems,
    systems,
  };

  return {
    scene,
    camera,
    pipelines,
    scale,
    scaleHandlers,
    cameraInstances,
  };
}

beforeEach(() => {
  StubCRTPostFX.reset();
});

describe("CRTPlugin", () => {
  it("enables the pipeline and applies normalized options", () => {
    const CRTPlugin = loadCRTPlugin();
    const { scene, camera, pipelines, scaleHandlers } = createScene();
    const plugin = new CRTPlugin(scene as any, {} as any, "crt");

    plugin.enable({ curvature: 0.3 });

    assert.equal(pipelines.addPostPipeline.callCount(), 1);
    assert.equal(pipelines.addPostPipeline.calls[0][1], StubCRTPostFX);
    assert.equal(camera.setPostPipeline.callCount(), 1);
    assert.equal(StubCRTPostFX.instances.length, 1);
    const instance = StubCRTPostFX.instances[0];
    const setOptionsSpy = instance.setOptions as Spy;
    assert.equal(setOptionsSpy.callCount(), 1);
    assert.deepEqual(setOptionsSpy.calls[0][0], { ...TEST_DEFAULTS, curvature: 0.3 });

    const resizeHandler = scaleHandlers["resize"];
    assert.equal(typeof resizeHandler, "function");
    resizeHandler?.();
    assert.equal(setOptionsSpy.callCount(), 2);
  });

  it("removes the pipeline on disable", () => {
    const CRTPlugin = loadCRTPlugin();
    const { scene, camera } = createScene();
    const plugin = new CRTPlugin(scene as any, {} as any, "crt");

    plugin.enable();
    assert.equal(camera.removePostPipeline.callCount(), 0);

    plugin.disable();
    assert.equal(camera.removePostPipeline.callCount(), 1);
    assert.equal(camera.removePostPipeline.calls[0][0], "CRTPostFX");
  });

  it("updates active pipelines with normalized options", () => {
    const CRTPlugin = loadCRTPlugin();
    const { scene } = createScene();
    const plugin = new CRTPlugin(scene as any, {} as any, "crt");

    plugin.enable();
    const instance = StubCRTPostFX.instances[0];
    const setOptionsSpy = instance.setOptions as Spy;
    setOptionsSpy.reset();

    plugin.update({ wobbleAmp: 0.001 });

    assert.equal(setOptionsSpy.callCount(), 1);
    assert.deepEqual(setOptionsSpy.calls[0][0], {
      ...TEST_DEFAULTS,
      wobbleAmp: 0.001,
    });
  });

  it("is a no-op when the renderer is not WebGL", () => {
    const CRTPlugin = loadCRTPlugin();
    const { scene, camera, pipelines } = createScene(false);
    const plugin = new CRTPlugin(scene as any, {} as any, "crt");

    plugin.enable();

    assert.equal(pipelines.addPostPipeline.callCount(), 0);
    assert.equal(camera.setPostPipeline.callCount(), 0);

    plugin.update({ wobbleAmp: 0.001 });
    assert.equal(camera.getPostPipeline.callCount(), 0);

    plugin.disable();
    assert.equal(camera.removePostPipeline.callCount(), 0);
  });
});
