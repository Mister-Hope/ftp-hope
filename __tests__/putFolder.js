const { client, putFolder } = require("..");

// 连接客户端
client.connect(require("./loginDetail"));

client.on("ready", () => {
  putFolder("./tests/testFolder").then(() => {
    client.end();
  });
});
