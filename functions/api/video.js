/**
 * Pages Function: 从 R2 流式返回视频（支持拖动 + 跨域）
 * 支持 Range 请求，正确设置 CORS 与 Vary 头
 * 
 * R2 存储桶绑定说明：
 * - 在 wrangler.toml 中配置了 R2 绑定: binding = "file", bucket_name = "storage"
 * - Cloudflare 自动将 R2 存储桶注入到 env.file 变量中
 * - 不需要配置 URL、密钥或端点，所有认证和连接信息都由 Cloudflare 自动处理
 * - env.file 是一个完整的 R2 客户端对象，可直接调用 get/put/delete 等方法
 */
export async function onRequestGet(context) {
    const { env, request } = context;
    // env.file 是通过 wrangler.toml 中的 binding = "file" 配置自动注入的 R2 存储桶客户端
    // 对应的存储桶名称是 "storage"，Cloudflare 自动处理所有认证和路由
    const bucket = env.file;
    const key = 'kobe.mp4';

    try {
        const object = await bucket.get(key);
        if (!object) {
            return new Response('视频未找到', { status: 404 });
        }

        if (!object.body) {
            return new Response('视频内容为空', { status: 500 });
        }

        // === 设置响应头 ===
        const headers = new Headers();

        // 写入 R2 元数据（如 content-type）
        object.writeHttpMetadata(headers);
        headers.set('content-type', 'video/mp4'); // 确保类型正确
        headers.set('cache-control', 'public, max-age=31536000, immutable');
        headers.set('accept-ranges', 'bytes');

        // === 跨域 CORS 设置 ===
        const allowedOrigins = [
            'https://docker3.acgfans.online',
            'https://cf-workers-docker-io-emi.pages.dev',
            'https://kobe.acgfans.online',
            'https://kobe-3ij.pages.dev',
            'https://kobe.0b05.com'
        ];

        const requestOrigin = request.headers.get('Origin');

        // 只有匹配的域名才返回 Access-Control-Allow-Origin
        if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
            headers.set('Access-Control-Allow-Origin', requestOrigin);
        } else if (!requestOrigin) {
            // 如果没有 Origin 头，允许所有域访问
            headers.set('Access-Control-Allow-Origin', '*');
        }

        // === 关键：确保 Vary 包含 Origin，防止 CDN 缓存污染 ===
        const existingVary = headers.get('Vary') || '';
        const varyParts = existingVary.split(',').map(s => s.trim());
        if (!varyParts.includes('Origin')) {
            varyParts.push('Origin');
        }
        headers.set('Vary', varyParts.filter(Boolean).join(', '));

        // === 处理 Range 请求（支持拖动）===
        const range = request.headers.get('range');
        const fileSize = object.size;
        const total = fileSize - 1;

        if (!range) {
            // 全量请求
            return new Response(object.body, {
                status: 200,
                headers
            });
        }

        // 解析 Range: bytes=0-1023
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : total;

        // 范围校验
        if (isNaN(start) || start < 0 || start >= fileSize) {
            return new Response(`无效的起始位置: ${start}`, {
                status: 416,
                headers: { 'Content-Range': `bytes */${fileSize}` }
            });
        }

        if (end >= fileSize || end < start) {
            return new Response(`无效的结束位置: ${end}`, {
                status: 416,
                headers: { 'Content-Range': `bytes */${fileSize}` }
            });
        }

        // 设置 206 Partial Content 响应头
        const chunkSize = (end - start) + 1;
        headers.set('content-range', `bytes ${start}-${end}/${fileSize}`);
        headers.set('content-length', chunkSize.toString());

        // === 流式传输：从 R2 读取并截取指定字节 ===
        const { readable, writable } = new TransformStream({
            transform(chunk, controller) {
                const buffer = chunk;
                const chunkStart = Math.max(0, start - bytesSent);
                const chunkEnd = Math.min(buffer.byteLength, end - bytesSent + 1);

                if (chunkStart < chunkEnd) {
                    controller.enqueue(buffer.slice(chunkStart, chunkEnd));
                }

                bytesSent += buffer.byteLength;

                if (bytesSent > end) {
                    controller.terminate();
                }
            }
        });

        let bytesSent = 0;
        object.body.pipeTo(writable);

        return new Response(readable, {
            status: 206,
            headers
        });

    } catch (err) {
        return new Response('服务器错误: ' + err.message, { status: 500 });
    }
}