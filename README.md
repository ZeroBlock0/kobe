# Kobe Tribute Video Player

这是一个使用 Cloudflare Pages + R2 实现的科比致敬视频播放器。

## 项目架构

该项目使用 Cloudflare Pages Functions 和 R2 存储服务来提供视频流媒体播放。

### R2 存储绑定机制

**问题：代码是如何知道 R2 的地址的？**

在 Cloudflare Workers/Pages 环境中，R2 存储不需要显式的 URL 地址。相反，它通过**环境绑定（Environment Bindings）**的方式自动注入到代码中。

#### 工作原理

1. **配置绑定** (`wrangler.toml`):
   ```toml
   [[r2_buckets]]
   binding = "file"           # 绑定名称
   bucket_name = "storage"    # R2 存储桶名称
   ```

2. **访问绑定** (`functions/api/video.js`):
   ```javascript
   const bucket = env.file;   // 通过 env.file 访问 R2 存储桶
   ```

3. **Cloudflare 自动注入**:
   - Cloudflare 在运行时自动将 `storage` 存储桶注入到 `env.file` 变量中
   - 无需配置 URL、密钥或端点地址
   - R2 客户端对象自动包含所有必要的认证和连接信息

#### 绑定流程

```
wrangler.toml 配置
    ↓
binding = "file" ──→ Cloudflare 运行时 ──→ env.file (R2 客户端)
bucket_name = "storage"                        ↓
                                         自动包含：
                                         - 存储桶连接
                                         - 认证凭证
                                         - API 端点
```

### 为什么不需要地址？

在传统的对象存储服务（如 AWS S3）中，你需要：
- 端点 URL（例如：`https://s3.amazonaws.com`）
- 访问密钥（Access Key）
- 密钥（Secret Key）
- 区域（Region）

但在 Cloudflare Workers/Pages 中：
- ✅ **自动认证**：Workers 运行在 Cloudflare 内部，自动拥有访问权限
- ✅ **自动路由**：Cloudflare 知道如何路由到正确的 R2 存储桶
- ✅ **零配置**：只需在 `wrangler.toml` 中声明绑定即可

### 项目结构

```
kobe/
├── wrangler.toml              # Cloudflare 配置文件
│   └── [[r2_buckets]]         # R2 绑定配置
├── functions/
│   └── api/
│       └── video.js           # 视频流 API (使用 env.file 访问 R2)
└── public/
    ├── index.html             # 前端页面
    └── js/
        └── index.js           # 前端脚本
```

## 功能特性

- 🎥 **流媒体播放**: 使用 R2 直接流式传输视频
- 📍 **Range 请求支持**: 支持视频拖动和断点续传
- 🌐 **CORS 跨域**: 正确配置跨域访问头
- 🔄 **自动循环**: 视频播放结束后自动重新开始
- 📱 **移动端优化**: 响应式设计，支持移动设备
- 🎵 **声音控制**: 用户可切换视频声音

## 本地开发

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 R2 存储桶（如果还未创建）
wrangler r2 bucket create storage

# 上传视频文件
wrangler r2 object put storage/kobe.mp4 --file=./path/to/kobe.mp4

# 本地开发
wrangler pages dev

# 部署到 Cloudflare Pages
wrangler pages deploy
```

## 技术栈

- **Cloudflare Pages**: 静态网站托管
- **Cloudflare Pages Functions**: 无服务器后端 API
- **Cloudflare R2**: 对象存储（兼容 S3 API）
- **原生 JavaScript**: 无需前端框架

## 致敬

此项目致敬永远的黑曼巴 - 科比·布莱恩特（Kobe Bryant, 1978-2020）

Mamba Out. 🏀💫
