export interface FTPError extends Error {
  code: number;
}

// Utility functions
export const getFTPError = (code: number, text: string): FTPError => {
  const err = new Error(text) as FTPError;
  err.code = code;
  return err;
};
