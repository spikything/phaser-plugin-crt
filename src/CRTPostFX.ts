import Phaser from "phaser";

export interface CRTPipelineOptions {
  curvature?: number; // 0.0 - 0.4
  scanlineIntensity?: number; // 0.0 - 0.5
  scanlineFreq?: number; // ~1.5 - 4.0
  wobbleAmp?: number; // 0.0 - 0.003
  wobbleFreq?: number; // 10 - 80
  vignette?: number; // 0.0 - 1.0
  desaturate?: number; // 0.0 - 1.0
  gamma?: number; // 0.8 - 1.2
  maskStrength?: number; // 0.0 - 0.1
  noise?: number; // 0.0 - 0.3
}

export const DEFAULTS: Required<CRTPipelineOptions> = {
  curvature: 0.15,
  scanlineIntensity: 0.15,
  scanlineFreq: 1.9,
  wobbleAmp: 0.0008,
  wobbleFreq: 40.0,
  vignette: 0.25,
  desaturate: 0.08,
  gamma: 1.05,
  maskStrength: 0.04,
  noise: 0.0,
};

export class CRTPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _time = 0;
  private _pendingOptions?: Required<CRTPipelineOptions>;

  private getActiveShader(): Phaser.Renderer.WebGL.WebGLShader | undefined {
    const self = this as unknown as {
      currentShader?: Phaser.Renderer.WebGL.WebGLShader;
      shaders?: Phaser.Renderer.WebGL.WebGLShader[];
    };

    return self.currentShader || self.shaders?.[0];
  }

  private applyPendingOptions(
    shader?: Phaser.Renderer.WebGL.WebGLShader
  ): void {
    if (!this._pendingOptions) return;

    const activeShader = shader ?? this.getActiveShader();
    if (!activeShader) return;

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

  constructor(game: Phaser.Game) {
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
  }

  onBoot(): void {
    this.applyPendingOptions();
  }

  onPreRender(): void {
    const shader = this.getActiveShader();
    if (!shader) return;

    const dt = (this.game.loop.delta || 16.7) / 1000;
    this._time += dt;
    this.set1f("time", this._time, shader);
    this.set2f("resolution", this.renderer.width, this.renderer.height, shader);
    this.applyPendingOptions(shader);
  }

  public setOptions(opts: Required<CRTPipelineOptions>): void {
    this._pendingOptions = opts;
    this.applyPendingOptions();
  }
}
