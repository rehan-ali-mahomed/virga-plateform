const request = require('supertest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.test') });

const app = require('../app');

describe('App', () => {
  test('health check endpoint returns 200', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });
});

afterAll(async () => {
    await new Promise((resolve) => setTimeout(() => resolve(), 5000));
    app.closeServer();
});