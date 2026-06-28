declare module 'opencascade.js/dist/opencascade.wasm.js' {
  type OpenCascadeFactory = new (options: { wasmBinary: Uint8Array }) => Promise<unknown>;

  const OpenCascadeFactory: OpenCascadeFactory;
  export default OpenCascadeFactory;
}
