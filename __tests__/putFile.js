const { client, putFile } = require("..");

// 连接客户端
client.connect(require("./loginDetail"));

client.on("ready", () => {
  putFile("./readme.md").then(() => {
    client.end();
  });
});
