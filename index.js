/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
/*
 * @Author: Mr.Hope
 * @Date: 2019-08-31 13:26:57
 * @LastEditors: Mr.Hope
 * @LastEditTime: 2019-10-20 00:04:33
 * @Description: FTP上传
 */

const fs = require('fs');
const path = require('path');
const FtpClient = require('ftp');

/** ftp 客户端实例 */
const client = new FtpClient();

/** 会话成功消息 */
client.on('greeting', msg => {
  console.log('ftp client says', msg);
});

/** ftp 客户端 ready */
client.on('ready', () => {
  console.log('FTP client is ready');
});
client.on('close', () => {
  console.log('FTP client is closed');
});
client.on('end', () => {
  console.log('FTP client has ended');
});
client.on('error', err => {
  console.error('FTP client has an error :', err);
});

/** 读取当前路径 */
const pwd = () =>
  new Promise((resolve, reject) => {
    client.pwd((err, currentpath) => {
      if (err) {
        console.error('列出当前目录出错:', err);
        return reject(err);
      }

      console.log(`当前目录为${currentpath}`);
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
        console.error(`cwd: 切换到${dirpath}目录出错`, err);

        return reject(err);
      }

      console.log(`当前目录为${dirpath}`);
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
        console.log(`切换到${actionPath}目录`);

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
        console.error(`list: 列出${dirpath}目录出错`, err2);

        return reject(err2);
      }

      console.log('文件列表为:', files);

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
        console.log(`${dirPath}文件夹已存在`);

        return resolve();
      }

      return fs.mkdir(dirPath, { recursive: true }, err2 => {
        if (err2) {
          console.error(`创建${dirPath}文件夹出错`, err2);

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
          console.log(`${onlineDirPath}文件夹已存在`);
          return resolve();
        }
        console.log(`已创建${onlineDirPath}文件夹`);

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
                  console.log(`已尝试创建文件夹${onlineDirPath}`);

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
          console.error(`获取${onlineFilePath}失败`, err2);

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
          console.error(`获取${onlineFilePath}失败`, err2);

          return reject(err2);
        }

        /** 创建 WriteStream */
        const ws = fs.createWriteStream(localFilePath);

        /** 写入文件 */
        rs.pipe(ws);

        console.error(`获取${onlineFilePath}成功`);

        return resolve();
      });
    })
  );
};

/**
 * 上传文件到指定地址
 *
 * @param {string} currentFile 当前文件路径
 * @param {string} targetFilePath 目标文件路径
 * @param {boolean} correctpath 是否已经切换到当前路径
 */
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
      client.put(rs, targetFilePath, err2 => {
        if (err2) {
          if (err2.message === 'Unable to make data connection') {
            console.log('未知获取错误');

            return resolve();
          }
          console.error(`上传${currentFile}到${targetFilePath}失败`, err2);

          return reject(err2);
        }

        console.log(`上传${currentFile}到${targetFilePath}成功`);

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
      client.put(rs, fileName, err2 => {
        if (err2) {
          console.error(`上传${currentFile}到${targetFilePath}失败`, err2);

          return reject(err2);
        }

        console.log(`上传${currentFile}到${targetFilePath}成功`);

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
    console.log('切换到', onlineDirectory, '开始获取文件夹');
    // 列出当前目录
    return listOnlineDir('./').then(files => {
      const promises = [];

      console.log('开始获取文件');
      files.forEach(file => {
        // 获取每一个文件
        if (file.type === '-')
          promises.push(
            getFile(`./${file.name}`, `${localDirectory}/${file.name}`)
          );
      });

      // 已经获取所有的文件
      return Promise.all(promises).then(async () => {
        console.log('开始获取文件夹');
        // 开始获取所有文件夹
        for (let index = 0; index < files.length; index++) {
          const file = files[index];

          // 依次获取每一个文件夹
          if (file.type === 'd' && file.name !== '.' && file.name !== '..') {
            console.log(`开始获取${onlineDirectory}/${file.name}文件夹`);
            // eslint-disable-next-line no-await-in-loop
            await getFolder(`./${file.name}`, `${localDirectory}/${file.name}`);
          }
        }

        console.log('获取文件夹完成');

        return resolve();
      });
    });
  });

/**
 * 上传文件夹
 *
 * @param {string} localDirectory 文件地址
 * @param {string} onlineDirectory 在线地址
 */
const putFolder = (localDirectory = './', onlineDirectory = localDirectory) => {
  console.log(`开始上传 ${onlineDirectory} 文件夹`);

  // 确保在线目录存在
  return markOnlineDirExist(onlineDirectory).then(() => {
    return pathAction(onlineDirectory, (resolve, reject) => {
      fs.readdir(localDirectory, { withFileTypes: true }, (err2, files) => {
        if (err2) {
          console.error(`读取本地文件夹 ${localDirectory} 出错`, err2);

          return reject(err2);
        }

        const promises = [];

        files.forEach(file => {
          // 是文件
          if (file.isFile())
            promises.push(
              putFile(`${localDirectory}/${file.name}`, `./${file.name}`)
            );
        });

        return Promise.all(promises)
          .then(async () => {
            console.log(`${onlineDirectory}文件上传完成`);
            console.log(`开始处理${onlineDirectory}文件夹`);
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

            console.log(`${onlineDirectory}上传全部完成`);

            return resolve();
          })
          .catch(err3 => reject(err3));
      });
    });
  });
};

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
