# bangumi-data-db

数据来自 [bangumi-data](https://github.com/bangumi-data/bangumi-data)，自动创建sqlite数据库文件，下载：[https://daonvshu.github.io/bangumi-data-db/bangumi.db](https://daonvshu.github.io/bangumi-data-db/bangumi.db)。

安装依赖：

```bash
npm install better-sqlite3 bangumi-data
```

运行：

```bash
npx ts-node scripts\gen.ts  
```