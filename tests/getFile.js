const { client, getFile } = require("..");

// 连接客户端
client.connect(require("./loginDetail"));

client.on("ready", () => {
  getFile("./readme.md").then(() => {
    client.end();
  });
});
