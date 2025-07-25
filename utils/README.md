# Job Guard Utilities

This module provides utilities for safely handling job data insertion and updates, preventing security vulnerabilities and data integrity issues.

## Overview

The job guard utilities implement a whitelist-based approach to data validation, ensuring that only valid columns are processed and inserted into the database. This prevents SQL injection attacks, XSS attempts, and unauthorized data manipulation.

## Functions

### `prepareJobForInsert(raw: unknown): JobInsert`

The main utility function that prepares raw job data for safe database insertion.

**Features:**
- ✅ Whitelists only valid columns
- ✅ Applies default values for required fields
- ✅ Validates data structure and types using Zod schema
- ✅ Prevents SQL injection and XSS attacks
- ✅ Throws descriptive errors for invalid data

**Usage:**
```typescript
import { prepareJobForInsert } from './utils/jobGuards';

// Example with potentially unsafe raw data
const rawJobData = {
  title: 'Software Engineer',
  url: 'https://company.com/jobs/123',
  companyId: 1,
  description: 'Great opportunity',
  // These malicious fields will be filtered out
  '; DROP TABLE jobs; --': 'malicious',
  'unauthorized_field': 'should not be allowed'
};

try {
  const safeJobData = prepareJobForInsert(rawJobData);
  // safeJobData now contains only valid, sanitized data
  console.log(safeJobData);
  // {
  //   title: 'Software Engineer',
  //   url: 'https://company.com/jobs/123',
  //   companyId: 1,
  //   description: 'Great opportunity',
  //   status: 'New',           // Default applied
  //   priority: 'medium',      // Default applied
  //   matchedKeywords: [],     // Default applied
  //   dateFound: '2023-...'    // Default applied (current timestamp)
  // }
} catch (error) {
  console.error('Job validation failed:', error.message);
}
```

### `sanitizeJobData(data: Record<string, unknown>): Record<string, unknown>`

Removes non-whitelisted columns without validation or default application.

**Usage:**
```typescript
import { sanitizeJobData } from './utils/jobGuards';

const unsafeData = {
  title: 'Developer',
  url: 'https://example.com',
  maliciousField: 'evil code'
};

const sanitized = sanitizeJobData(unsafeData);
// { title: 'Developer', url: 'https://example.com' }
```

### `validateJobColumns(data: Record<string, unknown>): ValidationResult`

Validates if an object contains only whitelisted job columns.

**Usage:**
```typescript
import { validateJobColumns } from './utils/jobGuards';

const result = validateJobColumns({
  title: 'Valid field',
  invalidField: 'Should not be here'
});

console.log(result);
// {
//   isValid: false,
//   invalidColumns: ['invalidField'],
//   validColumns: ['title']
// }
```

### `getValidJobColumns(): readonly (keyof JobInsert)[]`

Returns the list of valid job columns for reference.

**Usage:**
```typescript
import { getValidJobColumns } from './utils/jobGuards';

const validColumns = getValidJobColumns();
console.log(validColumns);
// ['title', 'url', 'matchedKeywords', 'dateFound', 'description', 'companyId', 'status', 'priority', 'salary', 'requirements', 'applicationDeadline']
```

## Valid Job Columns

The following columns are whitelisted for job data:

- `title` (string, required)
- `url` (string URL, required)
- `companyId` (number, required)
- `matchedKeywords` (string array, defaults to `[]`)
- `dateFound` (ISO datetime string, defaults to current time)
- `description` (string, optional)
- `status` (enum: 'New' | 'Seen' | 'Applied' | 'Archived', defaults to `'New'`)
- `priority` (enum: 'high' | 'medium' | 'low', defaults to `'medium'`)
- `salary` (string, optional)
- `requirements` (string array, optional)
- `applicationDeadline` (ISO datetime string, optional)

## Security Features

### SQL Injection Prevention
```typescript
// This malicious input will be safely filtered
const maliciousData = {
  title: 'Developer',
  '; DROP TABLE jobs; --': 'malicious sql'
};

const safe = prepareJobForInsert(maliciousData);
// Only 'title' field will be preserved
```

### XSS Prevention
```typescript
// XSS attempts in field names are filtered out
const xssData = {
  title: 'Developer',
  '<script>alert("xss")</script>': 'xss attempt'
};

const safe = prepareJobForInsert(xssData);
// Script tag field name is removed
```

### Data Integrity
```typescript
// Invalid data types are caught by Zod validation
const invalidData = {
  title: 123, // Should be string
  url: 'not-a-url', // Should be valid URL
  companyId: 'not-a-number' // Should be number
};

// This will throw a validation error
try {
  prepareJobForInsert(invalidData);
} catch (error) {
  console.log('Validation failed:', error.message);
}
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- __tests__/jobGuards.test.ts
```

The tests cover:
- ✅ Valid data processing
- ✅ Default value application
- ✅ Input validation and error handling
- ✅ Security vulnerability prevention
- ✅ Edge cases and malicious input
- ✅ Integration workflows

## Best Practices

1. **Always use `prepareJobForInsert()`** before database operations
2. **Handle validation errors gracefully** with try-catch blocks
3. **Log security violations** when malicious data is detected
4. **Review the whitelist** when adding new job fields to the schema
5. **Run tests** after any changes to ensure security is maintained

## Example Integration

```typescript
// In your job creation service
import { prepareJobForInsert } from './utils/jobGuards';

export async function createJob(rawJobData: unknown) {
  try {
    // Sanitize and validate the input
    const safeJobData = prepareJobForInsert(rawJobData);
    
    // Now safe to insert into database
    const result = await database.jobs.insert(safeJobData);
    
    return { success: true, job: result };
  } catch (error) {
    console.error('Job creation failed:', error.message);
    return { success: false, error: error.message };
  }
}
```

This approach ensures that your application remains secure while maintaining data integrity and preventing common web vulnerabilities.
