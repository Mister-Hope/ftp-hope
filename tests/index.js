/* eslint-disable no-console */
const { client } = require('..');

// 连接客户端
client.connect(require('./loginDetail'));

client.on('ready', () => {
  // 列出目录信息
  client.list((err2, files) => {
    if (err2) console.error('列出目录出错:', err2);

    console.log('列出目录成功', files.map(file => file.name));
  });
});
