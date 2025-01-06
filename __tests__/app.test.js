const request = require('supertest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.test') });

const app = require('../app');
const { initializeDatabase } = require('../src/config/database');

let server;

const waitForServer = (port) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeout = 10000; // 10 seconds timeout
    const interval = 300; // Check every 300ms

    const checkServer = () => {
      request(app)
        .get('/health')
        .end((err, res) => {
          if (res && res.status === 200) {
            resolve();
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('Server startup timeout'));
          } else {
            setTimeout(checkServer, interval);
          }
        });
    };

    checkServer();
  });
};

describe('App', () => {
  beforeAll(async () => {
    // Initialize database first
    await initializeDatabase();
    
    // Start the server
    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT);
    
    // Wait for server to be ready
    await waitForServer(PORT);
  }, 12000); // Increase timeout to 12 seconds for server startup

  test('health check endpoint returns 200', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });

  afterAll(async () => {
    // Cleanup: close server and database connections
    await app.closeServer();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

