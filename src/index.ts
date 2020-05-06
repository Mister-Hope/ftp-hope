import {
  cwd,
  listOnlineDir,
  markDirExist,
  markOnlineDirExist,
  pwd
} from './ftp-dir';
import { getFile, getFolder } from './ftp-get';
import { putFile, putFolder } from './ftp-put';
import client from './ftp-client';

export = {
  client,
  cwd,
  default: {
    client,
    cwd,
    getFile,
    getFolder,
    listOnlineDir,
    markDirExist,
    markOnlineDirExist,
    putFile,
    putFolder,
    pwd
  },
  getFile,
  getFolder,
  listOnlineDir,
  markDirExist,
  markOnlineDirExist,
  putFile,
  putFolder,
  pwd
};
