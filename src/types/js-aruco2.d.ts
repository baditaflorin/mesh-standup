declare module "js-aruco2" {
  export const AR: {
    DICTIONARIES: Record<string, unknown>;
    Dictionary: new (name: string) => { codeList: string[]; nBits: number };
    Detector: new (opts?: { dictionaryName?: string; maxHammingDistance?: number }) => {
      detect: (imageData: ImageData) => Array<{
        id: number;
        corners: Array<{ x: number; y: number }>;
        hammingDistance?: number;
      }>;
    };
    Marker: unknown;
  };
}
