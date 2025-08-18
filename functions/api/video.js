/**
 * Pages Function: 从 R2 流式返回视频（支持拖动 + 跨域）
 * @see https://developers.cloudflare.com/pages/functions/api-reference/
 */
export async function onRequestGet(context) {
    const { env, request } = context;
    const bucket = env.file;
    const key = 'kobe.mp4';

    try {
        const object = await bucket.get(key);
        if (!object) {
            return new Response('视频未找到', { status: 404 });
        }

        // 检查 object.body 是否存在
        if (!object.body) {
            return new Response('视频内容为空', { status: 500 });
        }

        // === 设置 CORS ===
        const headers = new Headers();

        const allowedOrigins = [
            'https://docker3.acgfans.online',
            'https://cf-workers-docker-io-emi.pages.dev',
            'https://kobe.acgfans.online'
        ];

        const requestOrigin = request.headers.get('Origin');

        // 只有匹配的域名才设置 Access-Control-Allow-Origin
        if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
            headers.set('Access-Control-Allow-Origin', requestOrigin);
        }

        // 必须设置 Vary: Origin，避免 CDN 缓存污染
        headers.set('Vary', 'Origin');

        // === 基础响应头 ===
        object.writeHttpMetadata(headers);
        headers.set('content-type', 'video/mp4');
        headers.set('cache-control', 'public, max-age=31536000, immutable');
        headers.set('accept-ranges', 'bytes');

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

        // 解析 Range
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

        // 创建 TransformStream 流式处理
        const { readable, writable } = new TransformStream({
            transform(chunk, controller) {
                const buffer = chunk;
                const bytesSentSoFar = controller.desiredSize ? 0 : /* 实际已发送量 */ 0;
                // 简化逻辑：直接计算当前 chunk 的有效部分
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
        object.body.pipeTo(writable); // 将 R2 流写入 TransformStream

        return new Response(readable, {
            status: 206,
            headers
        });

    } catch (err) {
        return new Response('服务器错误: ' + err.message, { status: 500 });
    }
}