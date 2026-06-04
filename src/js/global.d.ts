declare module "*.png";
declare module "*.gif";
declare module "*.jpg";
declare module "*.svg";

// CEP runtime globals injected by Adobe Creative Cloud Extension Environment
interface Window {
  __nyuukouLog?: (event: string, detail?: Record<string, unknown>) => void;
  cep: {
    fs: {
      readFile(path: string, encoding?: string): { err: number; data: string };
      writeFile(path: string, data: string, encoding?: string): { err: number };
      deleteFile(path: string): { err: number };
      readdir(path: string): { err: number; data: string[] };
      makedir(path: string): { err: number };
      rename(from: string, to: string): { err: number };
      stat(path: string): { err: number; data: { isFile(): boolean; isDirectory(): boolean; mtime: Date; ctime: Date; atime: Date; size: number } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  __adobe_cep__: {
    getHostEnvironment(): string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}
