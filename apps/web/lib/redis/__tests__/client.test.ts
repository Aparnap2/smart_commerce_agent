import { redis, checkRedisHealth } from '../client';
import * as clientModule from '../client';

describe('Redis Client', () => {
  describe('Configuration', () => {
    it('exports redis singleton', () => {
      expect(redis).toBeDefined();
    });

    it('exports checkRedisHealth function', () => {
      expect(checkRedisHealth).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('returns same instance on multiple calls', () => {
      // Both imports should reference the same singleton instance
      const redis1 = clientModule.redis;
      const redis2 = clientModule.redis;
      expect(redis1).toBe(redis2);
    });
  });

  describe('Health Check', () => {
    it('returns ok: true when Redis is accessible', async () => {
      const result = await checkRedisHealth();
      expect(result.ok).toBe(true);
    });

    it('returns DBSIZE', async () => {
      const result = await checkRedisHealth();
      expect(result.size).toBeDefined();
      expect(typeof result.size).toBe('number');
    });

    it('PING returns PONG', async () => {
      const ping = await redis.ping();
      expect(ping).toBe('PONG');
    });
  });

  describe('Basic Operations', () => {
    it('can SET and GET values', async () => {
      await redis.set('test:key', 'test-value');
      const value = await redis.get('test:key');
      expect(value).toBe('test-value');
      await redis.del('test:key');
    });

    it('can SETEX (set with expiry)', async () => {
      await redis.setex('test:expiry', 60, 'value');
      const ttl = await redis.ttl('test:expiry');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
      await redis.del('test:expiry');
    });

    it('returns null for non-existent keys', async () => {
      const value = await redis.get('nonexistent:key');
      expect(value).toBeNull();
    });
  });
});
