import Phaser from 'phaser';

const DEFAULTS = {
    curvature: 0.15,
    scanlineIntensity: 0.15,
    scanlineFreq: 1.9,
    wobbleAmp: 0.0008,
    wobbleFreq: 40.0,
    vignette: 0.25,
    desaturate: 0.08,
    gamma: 1.05,
    maskStrength: 0.04,
    noise: 0.04,
};
class CRTPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    getActiveShader() {
        var _a;
        const self = this;
        return self.currentShader || ((_a = self.shaders) === null || _a === void 0 ? void 0 : _a[0]);
    }
    applyPendingOptions(shader) {
        if (!this._pendingOptions)
            return;
        const activeShader = shader !== null && shader !== void 0 ? shader : this.getActiveShader();
        if (!activeShader)
            return;
        const opts = this._pendingOptions;
        this.set1f("curvature", opts.curvature, activeShader);
        this.set1f("scanlineIntensity", opts.scanlineIntensity, activeShader);
        this.set1f("scanlineFreq", opts.scanlineFreq, activeShader);
        this.set1f("wobbleAmp", opts.wobbleAmp, activeShader);
        this.set1f("wobbleFreq", opts.wobbleFreq, activeShader);
        this.set1f("vignetteAmt", opts.vignette, activeShader);
        this.set1f("desaturateAmt", opts.desaturate, activeShader);
        this.set1f("gammaAmt", opts.gamma, activeShader);
        this.set1f("maskStrength", opts.maskStrength, activeShader);
        this.set1f("noiseAmt", opts.noise, activeShader);
    }
    constructor(game) {
        super({
            game,
            name: "CRTPostFX",
            // language=GLSL
            fragShader: `
      precision mediump float;

      uniform sampler2D uMainSampler;
      varying vec2 outTexCoord;

      uniform float time;
      uniform vec2 resolution;

      uniform float curvature;
      uniform float scanlineIntensity;
      uniform float scanlineFreq;
      uniform float wobbleAmp;
      uniform float wobbleFreq;
      uniform float vignetteAmt;
      uniform float desaturateAmt;
      uniform float gammaAmt;
      uniform float maskStrength;
      uniform float noiseAmt;

      vec2 barrel(vec2 uv, float amt) {
        vec2 cc = uv - 0.5;
        float dist = dot(cc, cc);
        return uv + cc * dist * amt;
      }

      float vignette(vec2 uv, float amt) {
        float d = distance(uv, vec2(0.5));
        float inner = 0.3;
        float outer = 0.75;
        float t = smoothstep(inner, outer, d);
        return mix(1.0, 1.0 - amt, t);
      }

      float random(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        vec2 uv = outTexCoord;

        uv = barrel(uv, curvature);
        uv.x += sin((uv.y + time * 0.6) * wobbleFreq) * wobbleAmp;

        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        vec3 col = texture2D(uMainSampler, uv).rgb;

        float scan = 1.0 - scanlineIntensity * (0.5 + 0.5 * sin((uv.y * resolution.y) * 3.1415926 * scanlineFreq));
        col *= scan;

        float mask = 1.0 - maskStrength * (0.5 + 0.5 * sin((uv.x * resolution.x) * 3.1415926 * 2.0));
        col *= vec3(1.0, mask, 1.0);

        col *= vignette(uv, vignetteAmt);

        float gray = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(gray), desaturateAmt);
        col = pow(col, vec3(gammaAmt));

        float frameSeed = floor(time * 120.0);
        float grain = random(gl_FragCoord.xy + vec2(frameSeed, frameSeed * 1.37));
        float coarse = step(0.5, grain);
        float staticValue = mix(grain, coarse, 0.6);
        float noiseStrength = clamp(noiseAmt * 3.5, 0.0, 1.0);
        col = mix(col, vec3(staticValue), noiseStrength);

        gl_FragColor = vec4(col, 1.0);
      }
      `,
        });
        this._time = 0;
    }
    onBoot() {
        this.applyPendingOptions();
    }
    onPreRender() {
        const shader = this.getActiveShader();
        if (!shader)
            return;
        const dt = (this.game.loop.delta || 16.7) / 1000;
        this._time += dt;
        this.set1f("time", this._time, shader);
        this.set2f("resolution", this.renderer.width, this.renderer.height, shader);
        this.applyPendingOptions(shader);
    }
    setOptions(opts) {
        this._pendingOptions = opts;
        this.applyPendingOptions();
    }
}

function isWebGL(scene) {
    if (!scene)
        return false;
    const renderer = scene.game.renderer;
    if (renderer && renderer.gl) {
        return true;
    }
    const type = renderer === null || renderer === void 0 ? void 0 : renderer.type;
    return type === Phaser.WEBGL;
}
function normalize(opts) {
    return { ...DEFAULTS, ...(opts || {}) };
}
class CRTPlugin extends Phaser.Plugins.ScenePlugin {
    constructor(scene, pluginManager, pluginKey) {
        super(scene, pluginManager, pluginKey);
        this.enabled = false;
    }
    boot() {
        const systems = this.systems;
        if (!systems)
            return;
        const events = systems.events;
        events.on(Phaser.Scenes.Events.SHUTDOWN, this.disable, this);
        events.on(Phaser.Scenes.Events.DESTROY, this.disable, this);
    }
    ensureRegistered(scene) {
        var _a, _b, _c, _d;
        const name = "CRTPostFX";
        // @ts-ignore private-ish registries differ by Phaser versions
        const reg = (_a = scene.game.renderer) === null || _a === void 0 ? void 0 : _a.pipelines;
        const already = ((_b = reg === null || reg === void 0 ? void 0 : reg._postPipelineClasses) === null || _b === void 0 ? void 0 : _b[name]) || ((_d = (_c = reg === null || reg === void 0 ? void 0 : reg.postFX) === null || _c === void 0 ? void 0 : _c.pipelines) === null || _d === void 0 ? void 0 : _d[name]);
        if (!already) {
            const renderer = scene.renderer;
            if (renderer && "pipelines" in renderer) {
                renderer.pipelines.addPostPipeline(name, CRTPostFX);
            }
        }
    }
    forEachCam(scene, fn) {
        var _a;
        (_a = scene.cameras) === null || _a === void 0 ? void 0 : _a.cameras.forEach(fn);
    }
    applyOptionsToCameras(scene, opts) {
        this.forEachCam(scene, (cam) => {
            const instances = cam.getPostPipeline("CRTPostFX");
            const arr = Array.isArray(instances)
                ? instances
                : instances
                    ? [instances]
                    : [];
            arr.forEach((p) => p.setOptions(opts));
        });
    }
    enable(options) {
        var _a;
        const scene = this.scene;
        if (!isWebGL(scene))
            return;
        this.ensureRegistered(scene);
        this.forEachCam(scene, (cam) => cam.setPostPipeline("CRTPostFX"));
        this.applyOptionsToCameras(scene, normalize(options));
        this.enabled = true;
        (_a = scene.scale) === null || _a === void 0 ? void 0 : _a.on("resize", () => {
            this.applyOptionsToCameras(scene, normalize(options));
        });
    }
    disable() {
        const scene = this.scene;
        if (!isWebGL(scene))
            return;
        this.forEachCam(scene, (cam) => {
            try {
                cam.removePostPipeline("CRTPostFX");
            }
            catch { }
        });
        this.enabled = false;
    }
    update(options) {
        const scene = this.scene;
        if (!isWebGL(scene))
            return;
        this.applyOptionsToCameras(scene, normalize(options));
    }
    toggle(options) {
        if (this.enabled)
            this.disable();
        else
            this.enable(options);
    }
}

export { CRTPlugin };
//# sourceMappingURL=phaser-plugin-crt.esm.js.map
