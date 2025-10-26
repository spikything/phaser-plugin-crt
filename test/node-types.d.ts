declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    strictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  };
  export default assert;
}

declare module "node:test" {
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
}

declare module "node:module" {
  interface NodeModuleCtor {
    _load(request: string, parent: unknown, isMain: boolean): any;
  }
  const mod: {
    Module: NodeModuleCtor;
  };
  export default mod;
}

declare module "node:path" {
  const path: {
    resolve(...segments: string[]): string;
  };
  export default path;
}

declare interface NodeRequire {
  (id: string): any;
  cache: Record<string, { exports: any }>;
  resolve(id: string): string;
}

declare const require: NodeRequire;

declare const __dirname: string;

declare const process: {
  env: Record<string, string | undefined>;
};
