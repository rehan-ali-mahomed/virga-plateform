const assert = require('assert');
const { generatePDF } = require('../services/pdfGenerator');
const { db } = require('../config/database');

// Mock the database and response object
const mockDb = {
  get: (query, params, callback) => {
    if (params[0] === 1) {
      callback(null, { id: 1, date: '2023-04-01' });
    } else if (params[0] === 999) {
      callback(null, null);
    } else {
      callback(new Error('Database error'), null);
    }
  }
};

const mockRes = {
  setHeader: () => {},
};

// Replace the actual db with our mock
db.get = mockDb.get;

// Test cases
async function runTests() {
  console.log('Running pdfGenerator tests...');

  // Test 1: Valid report
  try {
    await generatePDF(1, mockRes, 'attachment');
    console.log('Test 1 passed: PDF generated for valid report');
  } catch (error) {
    console.error('Test 1 failed:', error.message);
  }

  // Test 2: Report not found
  try {
    await generatePDF(999, mockRes, 'attachment');
    console.error('Test 2 failed: Should have thrown an error');
  } catch (error) {
    if (error.message === 'Report not found') {
      console.log('Test 2 passed: Correct error for non-existent report');
    } else {
      console.error('Test 2 failed:', error.message);
    }
  }

  // Test 3: Database error
  try {
    await generatePDF(2, mockRes, 'attachment');
    console.error('Test 3 failed: Should have thrown an error');
  } catch (error) {
    if (error.message === 'An error occurred while generating the report.') {
      console.log('Test 3 passed: Correct error for database failure');
    } else {
      console.error('Test 3 failed:', error.message);
    }
  }
}

runTests();