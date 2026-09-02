# 10 - 后端 API 文档

> 文档版本：v1.0  
> 后端项目：`yue-backend/`（Spring Boot 3.2.5 + MySQL）  
> 前置约定：遵循 [00-开发约定.md](./00-开发约定.md)；本文档定义前后端联动的 HTTP API 契约

---

## 一、概述

| 项 | 说明 |
| --- | --- |
| 基础 URL | `http://localhost:8080`（开发）；生产由部署域名决定 |
| 数据格式 | `application/json; charset=UTF-8` |
| 鉴权方式 | JWT Bearer Token，登录后放入 `Authorization: Bearer <token>` |
| CORS | 后端放行 `http://localhost:*` 与 `http://127.0.0.1:*`，允许带凭证 |
| 功能范围 | 用户账号体系（注册/登录）+ 学习数据云端同步（GET/PUT） |

---

## 二、数据库

### 2.1 建库

```sql
CREATE DATABASE yue DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> `application.yml` 的 `spring.jpa.hibernate.ddl-auto=update` 会在后端首次启动时自动建表，下方 SQL 仅供手动建表或审查参考。

### 2.2 表结构

**users** — 用户表

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | BIGINT | PK, AUTO_INCREMENT | 用户 ID |
| username | VARCHAR(32) | NOT NULL, UNIQUE | 登录用户名（3~32 字符） |
| password_hash | VARCHAR(100) | NOT NULL | BCrypt 哈希密码 |
| created_at | DATETIME | NOT NULL | 注册时间 |

**learn_state** — 学习状态表（每用户一行）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL, UNIQUE | 关联 users.id |
| state_json | LONGTEXT | NOT NULL | 前端 LearningState 完整 JSON |
| updated_at | DATETIME | NOT NULL | 最后同步时间 |

### 2.3 建表 SQL（参考）

```sql
USE yue;

CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE learn_state (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  state_json LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_learn_state_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.4 state_json 结构

与前端 [04-数据库设计.md](./04-数据库设计.md) 的 `LearningState` 完全一致：

```json
{
  "learned": ["w1", "w3"],
  "stuck": ["w2"],
  "reviewed": ["w1"],
  "streak": 3,
  "lastDay": "2026-09-02",
  "todayLearned": 5,
  "todayLearnedDate": "2026-09-02",
  "todayReviewed": 2,
  "todayReviewedDate": "2026-09-02",
  "dailyGoal": 10,
  "activity": { "2026-09-02": 7 },
  "coins": 98,
  "owned": ["道具A"]
}
```

---

## 三、认证机制

1. 客户端 `POST /api/auth/register` 或 `/login`，服务端返回 `{ token, username, userId }`。
2. 客户端把 `token` 存入 `localStorage`（键 `yueToken`）。
3. 后续请求带 `Authorization: Bearer <token>`。
4. 服务端 `JwtAuthFilter` 校验签名与有效期，通过后把 `userId` 注入 `SecurityContext`。
5. Token 有效期 24 小时（`app.jwt.expiration-ms`）。

---

## 四、接口详述

### 4.1 注册

`POST /api/auth/register`

**请求体**
```json
{ "username": "cantoneseFan", "password": "yue2026" }
```

| 字段 | 类型 | 校验 |
| --- | --- | --- |
| username | string | 必填，3~32 字符 |
| password | string | 必填，6~64 字符 |

**成功响应** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "username": "cantoneseFan",
  "userId": 1
}
```

**失败响应** `400 Bad Request`
```json
{ "error": "用户名已存在" }
```

---

### 4.2 登录

`POST /api/auth/login`

**请求体**
```json
{ "username": "cantoneseFan", "password": "yue2026" }
```

**成功响应** `200 OK`（同注册）

**失败响应** `400 Bad Request`
```json
{ "error": "用户名或密码错误" }
```

---

### 4.3 获取学习状态

`GET /api/learn/state`

**请求头**
```
Authorization: Bearer <token>
```

**有云端记录** `200 OK`
```json
{
  "hasCloudData": true,
  "state": {
    "learned": ["w1", "w3"],
    "stuck": [],
    "coins": 98,
    "streak": 3
  }
}
```

**无云端记录**（新用户首次拉取） `200 OK`
```json
{ "hasCloudData": false }
```

**未登录** `401 Unauthorized`

---

### 4.4 上传学习状态

`PUT /api/learn/state`

**请求头**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**：整个 LearningState JSON（即 `state_json` 的内容）
```json
{
  "learned": ["w1", "w3"],
  "stuck": ["w2"],
  "reviewed": ["w1"],
  "streak": 3,
  "lastDay": "2026-09-02",
  "todayLearned": 5,
  "todayLearnedDate": "2026-09-02",
  "todayReviewed": 2,
  "todayReviewedDate": "2026-09-02",
  "dailyGoal": 10,
  "activity": { "2026-09-02": 7 },
  "coins": 98,
  "owned": ["道具A"]
}
```

**成功响应** `200 OK`
```json
{ "status": "synced", "updatedAt": "2026-09-02T12:34:56Z" }
```

**失败响应** `400 Bad Request`（如非合法 JSON）
```json
{ "error": "stateJson 不是合法 JSON" }
```

> 同步策略：**整体覆盖（last-write-wins）**。客户端每次上传会覆盖云端整条记录，不做字段级合并。

---

## 五、错误响应统一格式

| HTTP 状态 | 场景 | 响应体 |
| --- | --- | --- |
| 400 | 业务异常（用户名已存在、密码错误等） | `{"error": "..."}` |
| 400 | 参数校验失败 | `{"error": "username: 用户名长度 3~32; password: 密码长度 6~64"}` |
| 401 | 未登录或 token 失效 | 由 Spring Security 默认处理 |
| 500 | 未预期异常 | `{"error": "服务器内部错误"}`（不泄漏堆栈） |

---

## 六、前端接入说明

前端已通过最小侵入方式接入，**未重构任何现有状态机**：

| 改动文件 | 改动内容 |
| --- | --- |
| [src/lib/api.ts](file:///c:/Users/liu123/WorkBuddy/2026-09-01-20-12-50/yue-frontend/src/lib/api.ts) | 新增 API 客户端：register/login/fetchState/pushState + token 管理 |
| [src/lib/store.ts](file:///c:/Users/liu123/WorkBuddy/2026-09-01-20-12-50/yue-frontend/src/lib/store.ts) | `save()` 末尾加防抖上传触发；新增 `loginAndSync` / `registerAndSync` / `logout` |
| [src/components/AuthSheet.tsx](file:///c:/Users/liu123/WorkBuddy/2026-09-01-20-12-50/yue-frontend/src/components/AuthSheet.tsx) | 新增登录/注册抽屉（复用 Sheet 容器） |
| [src/screens/ProfileScreen.tsx](file:///c:/Users/liu123/WorkBuddy/2026-09-01-20-12-50/yue-frontend/src/screens/ProfileScreen.tsx) | 个人中心加登录入口 + 登录状态显示 |

### 同步时序

1. **登录**：`loginAndSync` → 调 `/api/auth/login` → 存 token → 调 `/api/learn/state` 拉云端 → 整体覆盖本地（`skipUpload` 防止回灌上传）。
2. **日常操作**：用户 `markLearned` 等动作触发 `save()` → `save` 内若已登录则 `scheduleUpload`（1.5s 防抖）→ 调 `PUT /api/learn/state` 上传整体 state。
3. **注册**：`registerAndSync` → 调 `/api/auth/register` → 存 token → 立即 `pushState` 上传当前本地状态作为云端初始记录。
4. **退出**：`logout` 仅清 token，本地数据保留。

### 部署时改 BASE

`src/lib/api.ts` 顶部：
```ts
const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";
```
生产构建前设置 `VITE_API_BASE=https://api.your-domain.com` 即可。

---

## 七、后端启动与联调

### 7.1 准备

1. 安装并启动 MySQL（5.7+ / 8.0+）。
2. 建库：`CREATE DATABASE yue DEFAULT CHARACTER SET utf8mb4;`
3. 修改 `yue-backend/src/main/resources/application.yml` 的 `username` / `password` 为你的 MySQL 账号。

### 7.2 启动（IntelliJ IDEA）

1. 用 IDEA 打开 `yue-backend/` 目录（作为 Maven 项目）。
2. IDEA 自动识别 `pom.xml` 并下载依赖（首次联网约 1~2 分钟）。
3. 运行 `YueApplication.java` 的 `main` 方法，或用 IDEA 内置 Maven 执行 `spring-boot:run`。
4. 控制台出现 `Started YueApplication` 即启动成功，监听 `8080`。

> 本机无 `mvn` 命令也可运行——IDEA 内置 Maven 足以完成依赖管理与启动。

### 7.3 联调步骤

1. 启动后端（8080）。
2. 启动前端：`cd yue-frontend && npm run dev`（3000）。
3. 浏览器打开 `http://localhost:3000`，进入「我」Tab。
4. 右上角点登录图标 → 注册一个账号 → 提示成功后，名字变为用户名、副标题变为"已登录 · 进度云端同步"。
5. 在「记粤语」「背粤语」做几个学习动作（等 1.5s 防抖）。
6. 切设备/清浏览器缓存后重新登录同一账号 → 学习进度从云端恢复。

### 7.4 快速验证（curl）

```bash
# 注册
curl -X POST http://localhost:8080/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"testuser\",\"password\":\"123456\"}"

# 登录
curl -X POST http://localhost:8080/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"testuser\",\"password\":\"123456\"}"

# 上传状态（把 <TOKEN> 换成登录返回的 token）
curl -X PUT http://localhost:8080/api/learn/state ^
  -H "Authorization: Bearer <TOKEN>" ^
  -H "Content-Type: application/json" ^
  -d "{\"learned\":[\"w1\"],\"coins\":100}"

# 拉取状态
curl -X GET http://localhost:8080/api/learn/state ^
  -H "Authorization: Bearer <TOKEN>"
```

---

## 八、安全注意事项

- `application.yml` 的 `app.jwt.secret` 为示例值，**生产前必须更换**为足够长的随机串（建议 `openssl rand -base64 48`）。
- 密码用 BCrypt 加盐哈希存储，不存明文。
- CORS 当前放行 localhost，**生产部署**应改为明确的前端域名。
- 同步策略为 last-write-wins，若同一账号在两设备同时操作，后写入者覆盖前者。
