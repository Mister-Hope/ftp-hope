/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
/*
 * @Author: Mr.Hope
 * @Date: 2019-10-20 00:39:58
 * @LastEditors: Mr.Hope
 * @LastEditTime: 2019-10-20 00:41:44
 * @Description: FTP 下载模块
 */

const fs = require('fs');
const path = require('path');
const client = require('./ftp-client');
const { pathAction, markDirExist, listOnlineDir } = require('./ftp-dir');

/**
 * 从指定目录下载文件
 *
 * @param {string} onlineFilePath 在线文件地址
 * @param {string} localFilePath 本地文件地址
 * @param {boolean} correctpath 是否已经切换到当前路径
 */
const getFile = (
  onlineFilePath,
  localFilePath = onlineFilePath,
  correctpath = false
) => {
  console.log(`开始获取${onlineFilePath}`);

  if (correctpath)
    return new Promise((resolve, reject) => {
      // 获取文件
      client.get(onlineFilePath, (err2, rs) => {
        if (err2) {
          if (err2.message === 'Unable to make data connection') {
            console.log('未知获取错误');

            return resolve();
          }
          console.error(`获取 ${onlineFilePath} 失败`, err2);

          return reject(err2);
        }

        /** 创建 WriteStream */
        const ws = fs.createWriteStream(localFilePath);

        /** 写入文件 */
        rs.pipe(ws);

        console.error(`获取${onlineFilePath}成功`);

        return resolve();
      });
    });

  /** 文件夹路径 */
  const onlineDirPath = path.dirname(onlineFilePath);

  /** 文件名称 */
  const onlineFileName = path.basename(onlineFilePath);

  /** 文件夹路径 */
  const localDirPath = path.dirname(localFilePath);

  // 确保目录存在
  return markDirExist(localDirPath).then(() =>
    pathAction(onlineDirPath, (resolve, reject) => {
      // 获取文件
      client.get(onlineFileName, (err2, rs) => {
        if (err2) {
          if (err2.message === 'Unable to make data connection') {
            console.log('未知获取错误');

            return resolve();
          }
          console.error(`获取 ${onlineFilePath} 失败`, err2);

          return reject(err2);
        }

        /** 创建 WriteStream */
        const ws = fs.createWriteStream(localFilePath);

        /** 写入文件 */
        rs.pipe(ws);

        // eslint-disable-next-line no-console
        console.error(`获取 ${onlineFilePath} 成功`);

        return resolve();
      });
    })
  );
};

/**
 * 下载文件夹
 *
 * @param {string} onlineDirectory 在线地址
 * @param {string} localDirectory 文件地址
 */
const getFolder = (onlineDirectory = './', localDirectory = onlineDirectory) =>
  pathAction(onlineDirectory, resolve => {
    // 列出当前目录
    return listOnlineDir('./').then(files => {
      const promises = [];

      console.log(`开始获取 ${onlineDirectory} 目录文件`);
      files.forEach(file => {
        // 获取每一个文件
        if (file.type === '-')
          promises.push(
            getFile(`./${file.name}`, `${localDirectory}/${file.name}`, true)
          );
      });

      // 已经获取所有的文件
      return Promise.all(promises)
        .then(async () => {
          console.log(`开始获取 ${onlineDirectory} 目录文件夹`);
          // 开始获取所有文件夹
          for (let index = 0; index < files.length; index++) {
            const file = files[index];

            // 依次获取每一个文件夹
            if (file.type === 'd' && file.name !== '.' && file.name !== '..')
              // eslint-disable-next-line no-await-in-loop
              await getFolder(
                `./${file.name}`,
                `${localDirectory}/${file.name}`
              );
          }

          console.log(`获取 ${onlineDirectory} 完成`);

          return resolve();
        })
        .catch(err => {
          console.log(`获取 ${onlineDirectory} 出错:`, err);
          resolve();
        });
    });
  });

module.exports = {
  getFile,
  getFolder
};
