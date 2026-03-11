import { config } from 'dotenv';

// Load environment variables for tests
config({ path: '.env.test' });
config({ path: '.env' });

// Set test environment
process.env.NODE_ENV = 'test';
