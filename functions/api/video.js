/**
 * Pages Function: 从 R2 流式返回视频（支持拖动）
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

        // 基础响应头
        const headers = new Headers();
        object.writeHttpMetadata(headers); // 写入 R2 元数据（如 content-type）
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
        if (start >= fileSize || start < 0 || end >= fileSize) {
            return new Response(`请求范围无效: ${start}-${end}/${fileSize}`, {
                status: 416,
                headers: {
                    'Content-Range': `bytes */${fileSize}`
                }
            });
        }

        // 设置 206 Partial Content 响应头
        const chunkSize = (end - start) + 1;
        headers.set('content-range', `bytes ${start}-${end}/${fileSize}`);
        headers.set('content-length', chunkSize.toString());

        // ✅ 正确创建 TransformStream（官方推荐模式）
        const { readable, writable } = new TransformStream({
            transform(chunk, controller) {
                const buffer = chunk;
                const chunkStart = start <= (total - buffer.byteLength + 1)
                    ? Math.max(0, start - bytesSent)
                    : 0;
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
        object.body?.pipeTo(writable); // 将 R2 流写入 TransformStream

        return new Response(readable, {
            status: 206,
            headers
        });

    } catch (err) {
        return new Response('服务器错误: ' + err.message, { status: 500 });
    }
}