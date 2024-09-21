import { Surreal } from 'surrealdb.node';
import Redis from 'ioredis';



const redisNode = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    secure: process.env.REDIS_SECURE ? true : false
};

export const redis = new Redis(
    `redis${redisNode.secure ? 's' : ''}://${redisNode.username}:${redisNode.password}@${redisNode.host}:${redisNode.port}/${redisNode.db}`
);



const surrealNode = {
    host: process.env.DB_HOST || 'localhost',
    port: +(process.env.DB_PORT || 8000),
    username: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || ''
};

export const db = new Surreal();

async function connect() {
    try {
        await db.connect(`ws://${surrealNode.host}:${surrealNode.port}`);

        await db.signin({
            username: surrealNode.username,
            password: surrealNode.password
        });

        await db.use({
            ns: 'essence-bot',
            db: 'essence-bot'
        })
    } catch (e) {

        console.error('[essence-bot] DB Error: ', e);

    }
}

connect();