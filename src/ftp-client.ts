import FtpClient from "ftp";

/** ftp 客户端实例 */
const client = new FtpClient();

/** 会话成功消息 */
client.on("greeting", (msg) => {
  console.log("ftp client says", msg);
});

/** ftp 客户端 ready */
client.on("ready", () => {
  console.log("FTP client is ready");
});

client.on("close", () => {
  console.log("FTP client is closed");
});

client.on("end", () => {
  console.log("FTP client has ended");
});

client.on("error", (err) => {
  console.error("FTP client has an error :", err);
});

export default client;
