export interface FTPOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean | "control" | "implicit";
  // TODO:
  secureOptions?: Record<string, any>;
  // TODO:
  debug?: (message: string) => void;
  connTimeout: number;
  pasvTimeout: number;
  aliveTimeout: number;
}

export const defaultOptions = {
  host: "localhost",
  port: 21,
  user: "anonymous",
  password: "anonymous@",
  secure: false,
  connTimeout: 10000,
  pasvTimeout: 10000,
  aliveTimeout: 10000,
};
