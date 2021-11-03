import ftpClient from "./ftp-client";

export const client = ftpClient;

export {
  cwd,
  listOnlineDir,
  markDirExist,
  markOnlineDirExist,
  pwd,
} from "./ftp-dir";
export { getFile, getFolder } from "./ftp-get";
export { putFile, putFolder } from "./ftp-put";
