// utils/jobGuards.ts
import { JobInsertSchema, type JobInsert } from '../types/database';

/**
 * Valid columns that can be inserted into the jobs table
 * This whitelist prevents unauthorized column insertion
 */
const VALID_JOB_COLUMNS: (keyof JobInsert)[] = [
  'title',
  'url',
  'matchedKeywords',
  'dateFound',
  'description',
  'companyId',
  'status',
  'priority',
  'salary',
  'requirements',
  'applicationDeadline'
];

/**
 * Prepares raw job data for safe database insertion by:
 * 1. Whitelisting only valid columns
 * 2. Validating data structure and types
 * 3. Applying default values where needed
 * 
 * @param raw - Raw job data that may contain extra or invalid properties
 * @returns Sanitized and validated job data ready for insertion
 * @throws {Error} If validation fails or required fields are missing
 */
export function prepareJobForInsert(raw: unknown): JobInsert {
  // First, ensure we have an object to work with
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid input: Expected an object');
  }

  const rawData = raw as Record<string, unknown>;
  
  // Whitelist only valid columns to prevent SQL injection and unwanted data
  const whitelistedData: Record<string, unknown> = {};
  
  for (const column of VALID_JOB_COLUMNS) {
    if (column in rawData) {
      whitelistedData[column] = rawData[column];
    }
  }

  // Apply default values for required fields if not provided
  if (!whitelistedData['status']) {
    whitelistedData['status'] = 'New';
  }

  if (!whitelistedData['priority']) {
    whitelistedData['priority'] = 'medium';
  }

  if (!whitelistedData['dateFound']) {
    whitelistedData['dateFound'] = new Date().toISOString();
  }

  if (!whitelistedData['matchedKeywords']) {
    whitelistedData['matchedKeywords'] = [];
  }

  // Validate the prepared data against the schema
  try {
    return JobInsertSchema.parse(whitelistedData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Job validation failed: ${error.message}`);
    }
    throw new Error('Job validation failed: Unknown error');
  }
}

/**
 * Validates if an object contains only whitelisted job columns
 * 
 * @param data - Object to validate
 * @returns Object with validation result and details
 */
export function validateJobColumns(data: Record<string, unknown>): {
  isValid: boolean;
  invalidColumns: string[];
  validColumns: string[];
} {
  const dataKeys = Object.keys(data);
  const validColumns: string[] = [];
  const invalidColumns: string[] = [];

  for (const key of dataKeys) {
    if (VALID_JOB_COLUMNS.includes(key as keyof JobInsert)) {
      validColumns.push(key);
    } else {
      invalidColumns.push(key);
    }
  }

  return {
    isValid: invalidColumns.length === 0,
    invalidColumns,
    validColumns
  };
}

/**
 * Sanitizes job data by removing any non-whitelisted columns
 * Unlike prepareJobForInsert, this doesn't validate or apply defaults
 * 
 * @param data - Raw job data
 * @returns Object with only whitelisted columns
 */
export function sanitizeJobData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const column of VALID_JOB_COLUMNS) {
    if (column in data) {
      sanitized[column] = data[column];
    }
  }
  
  return sanitized;
}

/**
 * Gets the list of valid job columns for reference
 * 
 * @returns Array of valid column names
 */
export function getValidJobColumns(): readonly (keyof JobInsert)[] {
  return VALID_JOB_COLUMNS;
}
