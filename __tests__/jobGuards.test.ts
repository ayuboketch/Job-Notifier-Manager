// __tests__/jobGuards.test.ts
import { prepareJobForInsert, sanitizeJobData, validateJobColumns, getValidJobColumns } from '../utils/jobGuards';

/** Mock job data for testing purposes **/
const validJobData = {
  title: 'Software Engineer',
  url: 'https://job.example.com',
  matchedKeywords: ['react', 'typescript'],
  dateFound: '2023-10-01T10:00:00Z',
  description: 'A great job opportunity.',
  companyId: 1,
  status: 'New' as const,
  priority: 'high' as const,
  salary: '$100,000',
  requirements: ['3+ years experience', 'BSc in Computer Science'],
  applicationDeadline: '2023-12-31T23:59:59Z',
  extraColumn: 'should be removed'
};

const minimalValidJobData = {
  title: 'Frontend Developer',
  url: 'https://company.com/jobs/frontend',
  companyId: 2
};

const invalidJobData = {
  invalidColumn: 'invalidData'
};

const maliciousJobData = {
  title: 'Software Engineer',
  url: 'https://job.example.com',
  companyId: 1,
  // Potential SQL injection attempt
  '; DROP TABLE jobs; --': 'malicious',
  '<script>alert("xss")</script>': 'xss attempt',
  'unauthorized_field': 'should not be allowed'
};

/** Tests for the prepareJobForInsert utility **/
describe('prepareJobForInsert', () => {
  it('should only include valid fields and apply defaults', () => {
    const prepared = prepareJobForInsert(validJobData);

    expect(prepared).toHaveProperty('title', 'Software Engineer');
    expect(prepared).toHaveProperty('url', 'https://job.example.com');
    expect(prepared).toHaveProperty('matchedKeywords', ['react', 'typescript']);
    expect(prepared).toHaveProperty('description', 'A great job opportunity.');
    expect(prepared).toHaveProperty('companyId', 1);
    expect(prepared).toHaveProperty('status', 'New');
    expect(prepared).toHaveProperty('priority', 'high');
    expect(prepared).toHaveProperty('salary', '$100,000');
    expect(prepared).toHaveProperty('requirements', ['3+ years experience', 'BSc in Computer Science']);
    expect(prepared).toHaveProperty('applicationDeadline', '2023-12-31T23:59:59Z');

    // Ensure unwanted fields are removed
    expect(prepared).not.toHaveProperty('extraColumn');
  });

  it('should apply default values for missing fields', () => {
    const prepared = prepareJobForInsert(minimalValidJobData);

    expect(prepared).toHaveProperty('title', 'Frontend Developer');
    expect(prepared).toHaveProperty('url', 'https://company.com/jobs/frontend');
    expect(prepared).toHaveProperty('companyId', 2);
    expect(prepared).toHaveProperty('status', 'New'); // Default applied
    expect(prepared).toHaveProperty('priority', 'medium'); // Default applied
    expect(prepared).toHaveProperty('matchedKeywords', []); // Default applied
    expect(prepared).toHaveProperty('dateFound'); // Default applied (current time)
    
    // Check that dateFound is a valid ISO string
    expect(prepared.dateFound).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should throw an error for invalid input data', () => {
    expect(() => prepareJobForInsert(invalidJobData)).toThrow('Job validation failed');
  });

  it('should throw an error for null or undefined input', () => {
    expect(() => prepareJobForInsert(null)).toThrow('Invalid input: Expected an object');
    expect(() => prepareJobForInsert(undefined)).toThrow('Invalid input: Expected an object');
  });

  it('should throw an error for primitive input types', () => {
    expect(() => prepareJobForInsert('string')).toThrow('Invalid input: Expected an object');
    expect(() => prepareJobForInsert(123)).toThrow('Invalid input: Expected an object');
    expect(() => prepareJobForInsert(true)).toThrow('Invalid input: Expected an object');
  });

  it('should prevent malicious data injection', () => {
    const prepared = prepareJobForInsert(maliciousJobData);

    // Should only contain whitelisted fields
    expect(prepared).toHaveProperty('title', 'Software Engineer');
    expect(prepared).toHaveProperty('url', 'https://job.example.com');
    expect(prepared).toHaveProperty('companyId', 1);
    
    // Should not contain malicious fields
    expect(prepared).not.toHaveProperty('; DROP TABLE jobs; --');
    expect(prepared).not.toHaveProperty('<script>alert("xss")</script>');
    expect(prepared).not.toHaveProperty('unauthorized_field');
  });

  it('should validate required fields are present after defaults', () => {
    const dataWithInvalidUrl = {
      title: 'Test Job',
      url: 'invalid-url', // Invalid URL format
      companyId: 1
    };

    expect(() => prepareJobForInsert(dataWithInvalidUrl)).toThrow('Job validation failed');
  });
});

/** Tests for the sanitizeJobData utility **/
describe('sanitizeJobData', () => {
  it('should remove non-whitelisted columns', () => {
    const sanitized = sanitizeJobData(validJobData);

    expect(sanitized).toHaveProperty('title', 'Software Engineer');
    expect(sanitized).toHaveProperty('url', 'https://job.example.com');
    expect(sanitized).not.toHaveProperty('extraColumn');
  });

  it('should return empty object for data with no valid columns', () => {
    const sanitized = sanitizeJobData({ invalidField: 'value' });
    expect(Object.keys(sanitized)).toHaveLength(0);
  });

  it('should preserve all valid columns', () => {
    const dataWithAllValidColumns = {
      title: 'Test',
      url: 'https://example.com',
      matchedKeywords: [],
      dateFound: new Date().toISOString(),
      description: 'desc',
      companyId: 1,
      status: 'New' as const,
      priority: 'high' as const,
      salary: null,
      requirements: null,
      applicationDeadline: null
    };

    const sanitized = sanitizeJobData(dataWithAllValidColumns);
    expect(Object.keys(sanitized)).toHaveLength(11);
  });
});

/** Tests for the validateJobColumns utility **/
describe('validateJobColumns', () => {
  it('should validate and recognize invalid columns', () => {
    const result = validateJobColumns(validJobData);

    expect(result.isValid).toBe(false);
    expect(result.invalidColumns).toContain('extraColumn');
    expect(result.validColumns).toContain('title');
    expect(result.validColumns).toContain('url');
    expect(result.validColumns).toContain('companyId');
  });

  it('should return valid for data with only whitelisted columns', () => {
    const validData = {
      title: 'Test Job',
      url: 'https://example.com',
      companyId: 1
    };

    const result = validateJobColumns(validData);
    expect(result.isValid).toBe(true);
    expect(result.invalidColumns).toHaveLength(0);
    expect(result.validColumns).toHaveLength(3);
  });

  it('should handle empty object', () => {
    const result = validateJobColumns({});
    expect(result.isValid).toBe(true);
    expect(result.invalidColumns).toHaveLength(0);
    expect(result.validColumns).toHaveLength(0);
  });
});

/** Tests for the getValidJobColumns utility **/
describe('getValidJobColumns', () => {
  it('should return all valid job columns', () => {
    const columns = getValidJobColumns();
    
    expect(columns).toContain('title');
    expect(columns).toContain('url');
    expect(columns).toContain('companyId');
    expect(columns).toContain('matchedKeywords');
    expect(columns).toContain('dateFound');
    expect(columns).toContain('description');
    expect(columns).toContain('status');
    expect(columns).toContain('priority');
    expect(columns).toContain('salary');
    expect(columns).toContain('requirements');
    expect(columns).toContain('applicationDeadline');
  });

  it('should return a readonly array', () => {
    const columns = getValidJobColumns();
    expect(Array.isArray(columns)).toBe(true);
    expect(columns.length).toBeGreaterThan(0);
  });
});

/** Integration tests **/
describe('Integration tests', () => {
  it('should work together for a complete data preparation workflow', () => {
    const rawJobData = {
      title: 'Full Stack Developer',
      url: 'https://company.com/jobs/fullstack',
      companyId: 5,
      description: 'Great opportunity',
      maliciousField: 'DROP TABLE users',
      anotherBadField: '<script>evil()</script>'
    };

    // First validate columns
    const validation = validateJobColumns(rawJobData);
    expect(validation.isValid).toBe(false);
    expect(validation.invalidColumns).toHaveLength(2);

    // Then sanitize the data
    const sanitized = sanitizeJobData(rawJobData);
    expect(sanitized).not.toHaveProperty('maliciousField');
    expect(sanitized).not.toHaveProperty('anotherBadField');

    // Finally prepare for insert
    const prepared = prepareJobForInsert(rawJobData);
    expect(prepared).toHaveProperty('title', 'Full Stack Developer');
    expect(prepared).toHaveProperty('status', 'New'); // Default applied
    expect(prepared).not.toHaveProperty('maliciousField');
    expect(prepared).not.toHaveProperty('anotherBadField');
  });
});

