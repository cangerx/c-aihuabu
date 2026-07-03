import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

export const IMAGE_GENERATION_QUEUE = "image-generation";

let redis: IORedis | null = null;
let imageQueue: Queue | null = null;

export function hasRedis() {
    return Boolean(process.env.REDIS_URL);
}

export function getRedis() {
    if (!process.env.REDIS_URL) throw new Error("未配置 REDIS_URL");
    redis ||= new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    return redis;
}

export function getImageGenerationQueue() {
    imageQueue ||= new Queue(IMAGE_GENERATION_QUEUE, { connection: getRedis() as unknown as ConnectionOptions });
    return imageQueue;
}
