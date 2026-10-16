// __tests__/sidemenu/react-test-renderer.d.ts
// react-test-renderer ships no types and @types/react-test-renderer is not installed, so TypeScript is told the module exists.
declare module "react-test-renderer" {
  export type ReactTestRenderer = any;
  export function create(element: any): any;
  export function act(callback: () => any): Promise<void>;
}
