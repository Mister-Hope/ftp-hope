/* eslint-disable no-console */
/*
 * @Author: Mr.Hope
 * @Date: 2019-10-20 00:36:37
 * @LastEditors: Mr.Hope
 * @LastEditTime: 2019-10-20 00:38:41
 * @Description: FTP 上传相关
 */

const fs = require('fs');
const path = require('path');
const client = require('./ftp-client');
const { pathAction, markOnlineDirExist } = require('./ftp-dir');

/**
 * 上传文件到指定地址
 *
 * @param {string} currentFile 当前文件路径
 * @param {string} targetFilePath 目标文件路径
 * @param {boolean} correctpath 是否已经切换到当前路径
 */
// eslint-disable-next-line max-lines-per-function
const putFile = (
  currentFile,
  targetFilePath = currentFile,
  correctpath = false
) => {
  console.log(`开始上传${targetFilePath}`);

  /** 创建 ReadStream */
  const rs = fs.createReadStream(currentFile);

  if (correctpath)
    return new Promise((resolve, reject) => {
      client.put(rs, targetFilePath, (err2) => {
        if (err2) {
          if (err2.message === 'Unable to make data connection') {
            console.log('未知获取错误');

            return resolve();
          }
          console.error(`上传 ${currentFile} 失败:`, err2);

          return reject(err2);
        }

        console.log(`上传 ${currentFile} 成功`);

        return resolve();
      });
    });

  /** 目标文件夹路径 */
  const dirpath = path.dirname(targetFilePath);

  /** 目标文件名称 */
  const fileName = path.basename(targetFilePath);

  // 确保在线目录存在
  return markOnlineDirExist(dirpath).then(() =>
    pathAction(dirpath, (resolve, reject) => {
      client.put(rs, fileName, (err2) => {
        if (err2) {
          console.error(`上传 ${currentFile} 失败:`, err2);

          return reject(err2);
        }

        console.log(`上传 ${currentFile} 成功`);

        return resolve();
      });
    })
  );
};

/**
 * 上传文件夹
 *
 * @param {string} localDirectory 文件地址
 * @param {string} onlineDirectory 在线地址
 */
const putFolder = (localDirectory = './', onlineDirectory = localDirectory) => {
  console.log(`开始上传 ${onlineDirectory} 目录文件`);

  // 确保在线目录存在
  return markOnlineDirExist(onlineDirectory).then(() => {
    return pathAction(onlineDirectory, (resolve, reject) => {
      fs.readdir(localDirectory, { withFileTypes: true }, (err2, files) => {
        if (err2) {
          console.error(`读取本地文件夹 ${localDirectory} 出错`, err2);

          return reject(err2);
        }

        const promises = [];

        files.forEach((file) => {
          // 是文件
          if (file.isFile())
            promises.push(
              putFile(`${localDirectory}/${file.name}`, `./${file.name}`, true)
            );
        });

        return Promise.all(promises)
          .then(async () => {
            console.log(`开始上传 ${onlineDirectory} 目录文件夹`);
            for (let index = 0; index < files.length; index++) {
              const file = files[index];

              // 是文件夹
              if (file.isDirectory())
                // eslint-disable-next-line no-await-in-loop
                await putFolder(
                  `${localDirectory}/${file.name}`,
                  `./${file.name}`
                );
            }

            console.log(`${onlineDirectory} 上传完成`);

            return resolve();
          })
          .catch((err) => {
            console.log(`上传 ${onlineDirectory} 出错:`, err);
            resolve();
          });
      });
    });
  });
};

module.exports = {
  putFile,
  putFolder
};
