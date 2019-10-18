/*
 * @Author: Mr.Hope
 * @Date: 2019-08-31 13:26:57
 * @LastEditors: Mr.Hope
 * @LastEditTime: 2019-10-18 20:18:15
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
  console.log('ftp client is ready');
});
client.on('close', () => {
  console.log('ftp client has close');
});
client.on('end', () => {
  console.log('ftp client has end');
});
client.on('error', err => {
  console.error('ftp client has an error :', err);
});

/** 读取当前路径 */
const pwd = () => new Promise((resolve, reject) => {
  client.pwd((err, currentpath) => {
    if (err) return reject(err);

    return resolve(currentpath);
  });
});

/**
 * 切换目录
 *
 * @param {string} dirpath 文件夹目录
 */
const cwd = dirpath => new Promise((resolve, reject) => {
  client.cwd(dirpath, err => {
    if (err) {
      console.error(`cwd: 切换到${dirpath}目录出错`, err);

      return reject(err);
    }

    return resolve();
  });
});

/**
 * 列出目标目录详情
 *
 * @param {string} dirpath 文件夹目录
 */
const listOnlineDir = dirpath => new Promise((resolve, reject) => {
  let currentPath;
  let fileList;

  // 读取当前目录
  pwd()
    .then(currentpath => {
      currentPath = currentpath;

      // 切换目录
      return cwd(dirpath);
    })
    .then(() => {
      // 列出目录信息
      client.list((err2, files) => {
        if (err2) {
          console.error(`list: 列出${dirpath}目录出错`, err2);

          return reject(err2);
        }
        console.log(fileList);
        fileList = files;

        // 切换回当前目录
        return cwd(currentPath).then(() => {
          // 成功返回文件列表
          resolve(fileList);
        }).catch(err => reject(err));
      });
    });
});


/**
 * 确认某个文件夹存在，如果不存在则创建它
 *
 * @param {string} dirPath 确认存在的文件夹路径
 */
const markDirExist = dirPath => new Promise((resolve, reject) => {
  fs.readdir(dirPath, err => {
    if (err) {
      console.log('文件夹已存在');

      return resolve();
    }

    fs.mkdir(dirPath, { recursive: true }, err2 => {
      if (err2) {
        console.error('创建文件夹出错', err2);

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
const markOnlineDirExist = (onlineDirPath, fast = true) => new Promise((resolve, reject) => {
  if (fast)
    client.mkdir(onlineDirPath, err => {
      if (err) return resolve();

      return resolve();
    });
  else
    pwd().then(currentpath => {

      cwd(onlineDirPath).then(() => {
        cwd(currentpath).then(() => {
          resolve();
        }).catch(err2 => reject(err2));
      }).catch(() => {
        client.mkdir(onlineDirPath, err3 => {
          if (err3) {
            console.log(`已尝试创建文件夹${onlineDirPath}`);

            return resolve();
          }

          cwd(currentpath).then(() => {
            resolve();
          }).catch(err2 => reject(err2));
        });
      });
    }).catch(err => reject(err));
});

/**
 * 从指定目录下载文件
 *
 * @param {string} onlineFilePath 在线文件地址
 * @param {string} localFilePath 本地文件地址
 */
const getFile = (onlineFilePath, localFilePath = onlineFilePath) => new Promise((resolve, reject) => {
  console.log(`开始获取${onlineFilePath}`);
  /** 文件夹路径 */
  const onlineDirPath = path.dirname(onlineFilePath);
  /** 文件名称 */
  const onlineFileName = path.basename(onlineFilePath);
  /** 文件夹路径 */
  const localDirPath = path.dirname(localFilePath);

  // 确保目录存在
  markDirExist(localDirPath).then(() => {
    // 获取当前目录
    pwd().then(currentpath => {
      // 移动到文件夹目录
      cwd(onlineDirPath).then(() => {
        // 获取文件
        client.get(onlineFileName, (err2, rs) => {
          if (err2) {
            if (err2.message === 'Unable to make data connection') {
              console.log('未知获取错误');

              return resolve(err2);
            }
            console.error(`获取${onlineFilePath}失败`, err2);

            return reject(err2);
          }
          /** 创建 WriteStream */
          const ws = fs.createWriteStream(localFilePath);

          /** 写入文件 */
          rs.pipe(ws);

          console.error(`获取${onlineFilePath}成功`);

          cwd(currentpath).then(() => resolve()).catch(err3 => reject(err3));
        });
      }).catch(err => reject(err));
    }).catch(err => reject(err));
  }).catch(err => reject(err));
});

/**
 * 上传文件到指定地址
 *
 * @param {string} currentFile 当前文件路径
 * @param {string} targetFilePath 目标文件路径
 * @return
 */
const putFile = (currentFile, targetFilePath = currentFile) => new Promise((resolve, reject) => {
  console.log(`开始上传${targetFilePath}`);
  /** 目标文件夹路径 */
  const dirpath = path.dirname(targetFilePath);
  /** 目标文件名称 */
  const fileName = path.basename(targetFilePath);
  /** 创建 ReadStream */
  const rs = fs.createReadStream(currentFile);

  // 确保在线目录存在
  markOnlineDirExist(dirpath).then(() => {
    // 移动目录
    pwd().then(currentpath => {
      cwd(dirpath).then(() => {
        client.put(rs, fileName, err2 => {
          if (err2) {
            console.error(`上传${currentFile}到${targetFilePath}失败`, err2);

            return reject(err2);
          }

          console.log(`上传${currentFile}到${targetFilePath}成功`);

          cwd(currentpath).then(() => resolve()).catch(err3 => reject(err3));
        });
      }).catch(err2 => reject(err2));
    });
  }).catch(err => reject(err));
});

/**
 * 下载文件夹
 *
 * @param {string} onlineDirectory 在线地址
 * @param {string} localDirectory 文件地址
 */
const getFolder = (onlineDirectory = './', localDirectory = onlineDirectory) => new Promise((resolve, reject) => {
  // 获取当前目录
  pwd().then(currentpath => {
    console.log('当前是', currentpath);
    // 切换到当前目录
    cwd(onlineDirectory).then(() => {
      console.log('切换到', onlineDirectory, '开始获取文件夹');
      // 列出当前目录
      listOnlineDir('./').then(files => {
        const promises = [];

        console.log('开始获取文件');
        files.forEach(file => {
          // 获取每一个文件
          if (file.type === '-')
            promises.push(getFile(`./${file.name}`, `${localDirectory}/${file.name}`));
        });

        // 已经获取所有的文件
        Promise.all(promises).then(async () => {

          console.log('开始获取文件夹');
          // 开始获取所有文件夹
          for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // 依次获取每一个文件夹
            if (file.type === 'd' && file.name !== '.' && file.name !== '..') {
              console.log(`开始获取${onlineDirectory}/${file.name}文件夹`);
              // eslint-disable-next-line no-await-in-loop
              await getFolder(`./${file.name}`, `${localDirectory}/${file.name}`);
            }
          }


          console.log('获取文件夹完成');
          // 切换回先前目录
          cwd(currentpath).then(() => {
            console.log('切换回先前目录:', currentpath);
            resolve();
          }).catch(err2 => reject(err2));
        }).catch(err => reject(err));
      });
    }).catch(err => reject(err));
  });
});

/**
 * 上传文件夹
 *
 * @param {string} localDirectory 文件地址
 * @param {string} onlineDirectory 在线地址
 */
const putFolder = (localDirectory = './', onlineDirectory = localDirectory) => new Promise((resolve, reject) => {
  console.log(`开始上传 ${onlineDirectory} 文件夹`);

  // 确保在线目录存在
  markOnlineDirExist(onlineDirectory).then(() => {
    // 获取当前路径
    pwd().then(currentpath => {
      // 切换在线文件夹
      cwd(onlineDirectory).then(() => {
        fs.readdir(localDirectory, { withFileTypes: true }, (err2, files) => {
          if (err2) {
            console.error(`读取本地文件夹 ${localDirectory} 出错`, err2);

            return reject(err2);
          }

          const promises = [];

          files.forEach(file => {
            // 是文件
            if (file.isFile())
              promises.push(putFile(`${localDirectory}/${file.name}`, `./${file.name}`));
          });

          Promise.all(promises).then(async () => {
            console.log(`${onlineDirectory}文件上传完成`);
            console.log(`开始处理${onlineDirectory}文件夹`);
            for (let i = 0; i < files.length; i++) {
              const file = files[i];

              // 是文件夹
              if (file.isDirectory())
                // eslint-disable-next-line no-await-in-loop
                await putFolder(`${localDirectory}/${file.name}`, `./${file.name}`);
            }

            console.log(`${onlineDirectory}上传全部完成`);
            // 切换回先前目录
            cwd(currentpath).then(() => {
              console.log(`切换回 ${currentpath}`);
              resolve();
            }).catch(err3 => reject(err3));
          }).catch(err3 => reject(err3));
        });
      }).catch(err2 => reject(err2));
    });
  }).catch(err => reject(err));
});

module.exports = {
  client,
  pwd,
  cwd,
  markDirExist,
  markOnlineDirExist,
  listOnlineDir,
  getFile,
  putFile,
  getFolder,
  putFolder
};
