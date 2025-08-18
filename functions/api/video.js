/**
 * Pages Function: 从 R2 读取视频并流式返回
 */
export async function onRequestGet(context) {
    const { env } = context;
    const bucket = env.file; // 绑定的 R2 存储桶

    const key = 'kobe.mp4'; // 视频在 R2 中的文件名

    try {
        const object = await bucket.get(key);

        if (!object) {
            return new Response('视频未找到', { status: 404 });
        }

        // 构造响应头，支持视频流（如拖动进度条）
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('content-type', 'video/mp4');
        headers.set('cache-control', 'public, max-age=31536000, immutable'); // 长期缓存

        // 支持范围请求（Range Requests），用于视频拖动
        const { request } = context;
        const range = request.headers.get('range');

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : object.size - 1;
            const chunk = end - start + 1;

            headers.set('content-range', `bytes ${start}-${end}/${object.size}`);
            headers.set('content-length', chunk);
            headers.set('status', '206');

            // 使用正确的 TransformStream 实现
            const transformStream = new TransformStream(new PipeRangeTransformer(start, end));
            const body = object.body?.pipeThrough(transformStream);

            return new Response(body, {
                status: 206,
                headers
            });
        }

        return new Response(object.body, {
            status: 200,
            headers
        });

    } catch (err) {
        return new Response('服务器错误: ' + err.message, { status: 500 });
    }
}

// 正确的 TransformStream 实现
class PipeRangeTransformer {
    constructor(start, end) {
        this.start = start;
        this.end = end;
        this.bytesSent = 0;
    }

    transform(chunk, controller) {
        const buffer = chunk;
        const start = this.bytesSent < this.start ? this.start - this.bytesSent : 0;
        const availableBytes = buffer.byteLength;
        const maxBytesToTake = this.end - this.start + 1 - this.bytesSent;
        const end = Math.min(start + maxBytesToTake, availableBytes);

        if (end > start) {
            controller.enqueue(buffer.slice(start, end));
        }

        this.bytesSent += availableBytes;

        if (this.bytesSent > this.end) {
            controller.terminate();
        }
    }
}