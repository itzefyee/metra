declare module 'opencascade.js' {
  export const initOpenCascade: (options?: any) => Promise<any>;
  export const ocCore: any;
  export const ocModelingAlgorithms: any;
  export const ocVisualApplication: any;
  export const ocDataExchangeBase: any;
  export const ocDataExchangeExtra: any;
  export const ocMainJS: any;
  export const ocMainWasm: any;
  const defaultExport: any;
  export default defaultExport;
}
