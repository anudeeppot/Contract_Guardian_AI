/**
 * Tests for Activity Service (CO4: Testing with Jest/Supertest)
 */
import request from 'supertest';
import { app } from '../src/index.js';

describe('Activity Service Health', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('contract-guardian-activity-service');
    expect(res.body.status).toBe('healthy');
  });
});

describe('Event Loop Demo', () => {
  test('GET /api/event-loop-demo returns phase info', async () => {
    const res = await request(app).get('/api/event-loop-demo');
    expect(res.status).toBe(200);
    expect(res.body.phases).toHaveLength(6);
    expect(res.body.concept).toBe('Node.js Event Loop');
  });
});

describe('Input Validation', () => {
  test('POST /api/activities without required fields returns 400', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({ description: 'Missing userId and activityType' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('404 Handler', () => {
  test('Unknown route returns 404', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.status).toBe(404);
  });
});
