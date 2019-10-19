/* eslint-disable no-console */
const { client, listOnlineDir } = require('..');

// 连接客户端
client.connect(require('./loginDetail'));

client.on('ready', () => {
  listOnlineDir('./').then(files => {
    console.log(files);
    client.end();
  });
});
