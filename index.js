/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
/*
 * @Author: Mr.Hope
 * @Date: 2019-08-31 13:26:57
 * @LastEditors: Mr.Hope
 * @LastEditTime: 2019-10-20 00:43:51
 * @Description: FTP上传
 */

const client = require('./src/ftp-client');
const {
  pwd,
  cwd,
  listOnlineDir,
  markDirExist,
  markOnlineDirExist
} = require('./src/ftp-dir');
const { getFile, getFolder } = require('./src/ftp-get');
const { putFile, putFolder } = require('./src/ftp-put');

module.exports = {
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
};
