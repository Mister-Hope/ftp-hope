/* eslint-disable no-console */
/*
 * @Author: Mr.Hope
 * @Date: 2019-10-20 00:33:38
 * @LastEditors: Mr.Hope
 * @LastEditTime: 2019-10-20 00:39:01
 * @Description: FTP 目录相关
 */

const client = require('./ftp-client');
const fs = require('fs');

/** 读取当前路径 */
const pwd = () =>
  new Promise((resolve, reject) => {
    client.pwd((err, currentpath) => {
      if (err) {
        console.error('列出当前目录出错:', err);
        return reject(err);
      }

      console.log(`当前目录为 ${currentpath}`);
      return resolve(currentpath);
    });
  });

/**
 * 切换目录
 *
 * @param {string} dirpath 文件夹目录
 */
const cwd = (dirpath, ...args) =>
  new Promise((resolve, reject) => {
    client.cwd(dirpath, err => {
      if (err) {
        console.error(`cwd: 切换到 ${dirpath} 目录出错`, err);

        return reject(err);
      }

      console.log(`当前目录为 ${dirpath}`);
      return resolve(...args);
    });
  });

/**
 * 在某个目录下目录，进行某些操作
 *
 * @param {string} actionPath 需要切换到的路径
 * @param {any} action 需要进行的行为
 */
const pathAction = (actionPath, action) =>
  // 读取当前目录
  pwd().then(currentpath => {
    console.log(`当前目录为${currentpath}`);

    if (actionPath === currentpath) {
      console.log('无需切换目录');

      return new Promise(action);
    }

    // 切换目录
    return cwd(actionPath)
      .then(() => {
        console.log(`切换到 ${actionPath} 目录`);

        return new Promise(action);
      })
      .then((...args) => {
        // 切换回当前目录
        console.log('任务完成');
        return cwd(currentpath, ...args);
      })
      .catch(() => {
        console.warn('任务失败，尝试切换回源目录');

        return cwd(currentpath);
      });
  });

/**
 * 列出目标目录详情
 *
 * @param {string} dirpath 文件夹目录
 */
const listOnlineDir = dirpath =>
  pathAction(dirpath, (resolve, reject) => {
    // 列出目录信息
    client.list((err2, files) => {
      if (err2) {
        console.error(`列出 ${dirpath} 目录出错:`, err2);

        return reject(err2);
      }

      console.log(`列出 ${dirpath} 目录成功`, files.map(file => file.name));

      // 切换回当前目录
      return resolve(files);
    });
  });

/**
 * 确认某个文件夹存在，如果不存在则创建它
 *
 * @param {string} dirPath 确认存在的文件夹路径
 */
const markDirExist = dirPath =>
  new Promise((resolve, reject) => {
    fs.readdir(dirPath, err => {
      if (err) {
        console.log(`${dirPath} 文件夹已存在`);

        return resolve();
      }

      return fs.mkdir(dirPath, { recursive: true }, err2 => {
        if (err2) {
          console.error(`创建 ${dirPath} 文件夹出错`, err2);

          return reject(err2);
        }

        return resolve();
      });
    });
  });

/**
 * 确保在线目录存在
 *
 * @param {string} onlineDirPath 在线文件夹目录
 * @param {boolean} fast 快速操作
 */
const markOnlineDirExist = (onlineDirPath, fast = true) =>
  new Promise((resolve, reject) => {
    if (fast)
      client.mkdir(onlineDirPath, true, err => {
        if (err) {
          console.log(`${onlineDirPath} 文件夹已存在`);
          return resolve();
        }
        console.log(`已创建 ${onlineDirPath} 文件夹`);

        return resolve();
      });
    else
      pwd()
        .then(currentpath => {
          cwd(onlineDirPath)
            .then(() => {
              cwd(currentpath)
                .then(() => {
                  resolve();
                })
                .catch(err2 => reject(err2));
            })
            .catch(() => {
              client.mkdir(onlineDirPath, err3 => {
                if (err3) {
                  console.log(`已尝试创建文件夹 ${onlineDirPath}`);

                  return resolve();
                }

                return cwd(currentpath)
                  .then(() => {
                    resolve();
                  })
                  .catch(err2 => reject(err2));
              });
            });
        })
        .catch(err => reject(err));
  });

module.exports = {
  cwd,
  listOnlineDir,
  markDirExist,
  markOnlineDirExist,
  pathAction,
  pwd
};
