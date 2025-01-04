const request = require('supertest');
const app = require('../app');

describe('App', () => {
  test('health check endpoint returns 200', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });
}); 