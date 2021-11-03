const { client, getFolder } = require("..");

// 连接客户端
client.connect(require("./loginDetail"));

client.on("ready", () => {
  getFolder("./tests/testFolder").then(() => {
    client.end();
  });
});
