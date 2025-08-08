/** @type {import('ts-jest').JestConfigWithTsJest} */

// jest.setup.js
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://mock-supabase-url.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
process.env.GROQ_API_KEY = 'mock-groq-key';
process.env.OPENROUTER_API_KEY = 'mock-openrouter-key';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  transform: {
    '^.+\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

module.exports.jest = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"]
};