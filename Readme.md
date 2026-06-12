# GitHub Pages + Supabase 远程多人投票工具：主持人 / 投票者分离版

## 文件说明

- `host.html`：主持人界面。创建投票、设置投票人数、每人票数、选项数量、选项名称和简介、查看结果。
- `vote.html`：投票者界面。投票者只能看到自己的投票栏、投票规则，填写自己的编号和名称后投票。
- `styles.css`：页面样式。
- `shared.js`：公共工具函数。
- `host.js`：主持人逻辑。
- `vote.js`：投票者逻辑。
- `config.js`：Supabase 配置。
- `supabase_schema.sql`：数据库表、策略和限制规则。

## 部署步骤

### 1. 创建 Supabase 项目

进入 Supabase，创建新项目。

### 2. 执行 SQL

在 Supabase 项目后台：

SQL Editor → New query → 粘贴 `supabase_schema.sql` → Run。

注意：这个 SQL 会重建相关表。如果你已有旧数据，执行前请备份。

### 3. 配置 config.js

打开 `config.js`，填入：

```js
window.SUPABASE_URL = "https://你的项目ID.supabase.co";
window.SUPABASE_ANON_KEY = "你的 anon 或 publishable key";
```

不要填写 service_role/secret key。

### 4. 上传到 GitHub Pages

把这些文件上传到 GitHub 仓库根目录：

```text
host.html
vote.html
styles.css
shared.js
host.js
vote.js
config.js
```

保留 `README.md` 和 `supabase_schema.sql` 也可以。

仓库 Settings → Pages → Deploy from a branch → main / root。

## 使用方法

1. 主持人打开 `host.html`
2. 设置投票标题、投票人数、每人票数、选项数量
3. 编辑每个选项的名称和简介
4. 创建投票
5. 复制“投票者链接”发给参与者
6. 投票者打开 `vote.html?poll=...`
7. 投票者填写投票人编号和名称
8. 投票者提交选择
9. 主持人在 `host.html` 输入投票 ID 或打开主持人结果链接，查看：
   - 已完成投票人数
   - 总票数
   - 各选项票数
   - 每个投票人名称
   - 每个投票人分别选择了哪些选项

## 重要限制

这个版本没有账号登录。

它适合：

- 朋友、小组、内部非正式投票
- 小型活动决策
- 主持人知道参与者编号的场景

不适合：

- 正式选举
- 强匿名投票
- 防作弊投票
- 涉及敏感信息的投票

因为参与者理论上可以输入别人的编号覆盖投票。后续可升级为“每人唯一投票码”版本。
