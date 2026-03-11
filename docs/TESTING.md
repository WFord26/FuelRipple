# Testing Infrastructure Guide

This document outlines the complete testing infrastructure for the FuelRipple monorepo.

## Overview

The project uses a **multi-framework testing approach**:
- **API (Node.js)**: Jest + Supertest for unit and integration tests
- **Web (React)**: Vitest + React Testing Library for component tests
- **Shared Packages**: Vitest for utility and business logic tests
- **Database**: Vitest with custom setup for query testing

## Running Tests

### Root Level
```bash
# Run all tests across the monorepo
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage reports
npm run test:coverage
```

### Individual Packages
```bash
# API tests
npm run test --workspace=@fuelripple/api

# Web tests
npm run test --workspace=@fuelripple/web

# Shared package tests
npm run test --workspace=@fuelripple/shared

# Impact engine tests
npm run test --workspace=@fuelripple/impact-engine

# Database tests
npm run test --workspace=@fuelripple/db
```

### With Watch Mode
```bash
npm run test:watch --workspace=@fuelripple/api
npm run test:watch --workspace=@fuelripple/web
```

### Coverage Reports
```bash
npm run test:coverage --workspace=@fuelripple/api
npm run test:coverage --workspace=@fuelripple/web
```

## Test File Organization

Tests are organized by package:

```
apps/api/src/
├── test/
│   ├── setup.ts              # Test setup and configuration
│   ├── test-utils.ts         # Shared test utilities
│   ├── api.integration.test.ts
│   └── middleware.test.ts
├── middleware/
│   └── errorHandler.ts
└── routes/
    └── ...

apps/web/src/
├── test/
│   ├── setup.ts              # Test setup and configuration
│   ├── test-utils.tsx        # Custom render + screen utilities
│   ├── Layout.test.tsx
│   └── hooks.test.ts
├── components/
│   └── Layout.tsx
└── hooks/
    └── usePageSEO.ts

packages/shared/src/
├── __tests__/
│   └── constants.test.ts
├── constants.ts
└── index.ts

packages/impact-engine/src/
├── __tests__/
│   └── correlation.test.ts
├── correlation.ts
└── index.ts
```

## Configuration Files

### API: `jest.config.js`
- Preset: ts-jest
- Environment: node
- Coverage Thresholds: 60% minimum
- Setup file: `src/test/setup.ts`

### Web: `vitest.config.ts`
- Environment: jsdom
- Globals: true (use describe/it directly)
- Coverage Thresholds: 70% minimum
- Setup file: `src/test/setup.ts`

### Packages: `vitest.config.ts`
- Environment: node
- Globals: true
- Coverage Thresholds: 65-75% minimum
- Setup files: Custom per package

## Writing Tests

### API Unit Tests (Jest)

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMockRequest, createMockResponse } from '../test/test-utils';

describe('My Feature', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
  });

  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### API Integration Tests (Jest + Supertest)

```typescript
import request from 'supertest';
import app from '../../index'; // Your Express app

describe('Health Check', () => {
  it('should return 200 on /health', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
  });
});
```

### React Component Tests (Vitest + RTL)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, createTestUser } from '../test/test-utils';
import MyComponent from '../../components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const user = createTestUser();
    render(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);
    
    expect(screen.getByText('Clicked!')).toBeInTheDocument();
  });
});
```

### Custom Hooks Tests

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyHook } from '../../hooks/useMyHook';

describe('useMyHook', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe('default');
  });

  it('should update value', async () => {
    const { result } = renderHook(() => useMyHook());
    
    await waitFor(() => {
      expect(result.current.value).toBe('updated');
    });
  });
});
```

### Shared Package Tests (Vitest)

```typescript
import { describe, it, expect } from 'vitest';

describe('My Utility', () => {
  it('should calculate correctly', () => {
    const result = myFunction(5, 3);
    expect(result).toBe(8);
  });
});
```

## Test Utilities

### API Test Utils (`apps/api/src/test/test-utils.ts`)

- `createTestClient(app)` - Create request client for testing
- `delay(ms)` - Wait for async operations
- `createMockRequest(overrides)` - Mock Express request
- `createMockResponse()` - Mock Express response
- `createMockNext()` - Mock next middleware function

### Web Test Utils (`apps/web/src/test/test-utils.tsx`)

- `render(component, options)` - Custom render with providers
- `createTestUser()` - Create user event object
- All exports from `@testing-library/react`

## Coverage Targets

| Package | Lines | Functions | Branches | Statements |
|---------|-------|-----------|----------|-----------|
| API | 60% | 60% | 60% | 60% |
| Web | 70% | 70% | 70% | 70% |
| Shared | 70% | 70% | 70% | 70% |
| Impact Engine | 75% | 75% | 75% | 75% |
| Database | 65% | 65% | 65% | 65% |

## CI/CD Integration

Tests are run automatically in CI/CD pipelines. Add to your GitHub Actions:

```yaml
- name: Run Tests
  run: npm test

- name: Generate Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Best Practices

### General
- ✅ Write tests for critical business logic
- ✅ Keep tests focused on one thing
- ✅ Use descriptive test names
- ✅ Mock external dependencies
- ✅ Run tests before committing

### API
- ✅ Test both success and error cases
- ✅ Test middleware in isolation
- ✅ Use integration tests for endpoint flows
- ✅ Mock database calls in unit tests

### React
- ✅ Test user interactions, not implementation
- ✅ Use semantic queries (getByRole, getByLabelText)
- ✅ Test accessibility features
- ✅ Avoid testing library internals

### All
- ✅ Keep tests DRY with beforeEach/afterEach
- ✅ Use consistent naming conventions
- ✅ Remove console.logs before committing
- ✅ Maintain >70% coverage (target 80%+)

## Troubleshooting

### Tests not found
- Ensure files follow naming convention: `*.test.ts`, `*.spec.ts`
- Check file location matches test configuration

### Import errors
- Verify tsconfig.json paths are correct
- Check monorepo workspace links
- Run `npm install` to install dependencies

### Module resolution issues
- Clear node_modules: `npm run clean && npm install`
- Check vitest/jest aliases in config files

### Type errors
- Ensure @types packages are installed
- Check tsconfig.json includes test files
- Regenerate types if needed

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Supertest](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
