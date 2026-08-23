const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const run = async () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "Milvus", "app.min.js"),
    "utf8",
  );
  const start = source.indexOf("const createEmojiImportId =");
  const end = source.indexOf("const EmojiBatchImporter =", start);
  assert.ok(start >= 0 && end > start, "找不到批量导入函数");

  const saved = [];
  const context = {
    URL,
    FileReader: function FileReader() {},
    console: { error() {} },
    window: {
      emojiStore: {
        save: async (emoji) => {
          if (emoji.url.includes("fail")) throw new Error("mock failure");
          saved.push(emoji);
        },
      },
    },
  };
  vm.runInNewContext(
    source
      .slice(start, end)
      .replace(
        /const (createEmojiImportId|parseImageUrlLines|readEmojiFile|importLocalImage|importLocalImages|importRemoteImage|importRemoteImages) =/g,
        "globalThis.$1 =",
      ),
    context,
  );

  const actual = JSON.parse(JSON.stringify(context.parseImageUrlLines(`
https://example.com/1.jpg
V我50 https://example.com/2.jpg
一起晒太阳 https://example.com/3.png
无效内容
ftp://example.com/4.jpg
  `)));

  assert.deepEqual(actual, [
    { name: "", url: "https://example.com/1.jpg" },
    { name: "V我50", url: "https://example.com/2.jpg" },
    { name: "一起晒太阳", url: "https://example.com/3.png" },
  ]);

  const result = await context.importRemoteImages(
    [
      { name: "一", url: "https://example.com/ok-1.jpg" },
      { name: "失败", url: "https://example.com/fail.jpg" },
      { name: "二", url: "https://example.com/ok-2.jpg" },
    ],
    () => {},
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { success: 2, failed: 1 });
  assert.deepEqual(saved.map(({ name, url }) => ({ name, url })), [
    { name: "一", url: "https://example.com/ok-1.jpg" },
    { name: "二", url: "https://example.com/ok-2.jpg" },
  ]);

  let activeReads = 0;
  let maxActiveReads = 0;
  context.importLocalImage = async (file) => {
    activeReads += 1;
    maxActiveReads = Math.max(maxActiveReads, activeReads);
    await Promise.resolve();
    activeReads -= 1;
    if (file.fail) throw new Error("mock failure");
  };
  const localResult = await context.importLocalImages(
    [{ name: "1.jpg" }, { name: "2.heic", fail: true }, { name: "3.png" }],
    () => {},
  );
  assert.deepEqual(JSON.parse(JSON.stringify(localResult)), { success: 2, failed: 1 });
  assert.equal(maxActiveReads, 1, "本地图片必须顺序读取");

  console.log("batch image import helpers: ok");
};

run();
