// examples/jobGuardsExample.ts
// Example showing how to integrate job guard utilities into your application

import { prepareJobForInsert, sanitizeJobData, validateJobColumns } from '../utils/jobGuards';

// Example 1: Safe job creation endpoint
export async function createJobEndpoint(req: any, res: any) {
  try {
    // Prepare the job data safely
    const safeJobData = prepareJobForInsert(req.body);
    
    // Now it's safe to insert into the database
    // const newJob = await database.jobs.insert(safeJobData);
    
    console.log('Job created successfully:', safeJobData);
    res.status(201).json({ success: true, job: safeJobData });
  } catch (error) {
    console.error('Job creation failed:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Example 2: Data validation before processing
export function validateIncomingJobData(rawData: unknown) {
  if (!rawData || typeof rawData !== 'object') {
    return { valid: false, message: 'Invalid data format' };
  }

  const validation = validateJobColumns(rawData as Record<string, unknown>);
  
  if (!validation.isValid) {
    console.warn('Invalid columns detected:', validation.invalidColumns);
    return { 
      valid: false, 
      message: `Invalid columns: ${validation.invalidColumns.join(', ')}`,
      invalidColumns: validation.invalidColumns
    };
  }

  return { valid: true, message: 'Data is valid' };
}

// Example 3: Data sanitization for logging or debugging
export function logJobData(rawData: unknown) {
  if (!rawData || typeof rawData !== 'object') {
    console.log('Invalid job data received:', rawData);
    return;
  }

  // Sanitize the data before logging to avoid logging sensitive information
  const sanitized = sanitizeJobData(rawData as Record<string, unknown>);
  console.log('Job data received:', sanitized);
}

// Example 4: Batch job processing with error handling
interface ProcessedJob {
  index: number;
  data: {
    title: string;
    url: string;
    matchedKeywords: string[];
    status: "New" | "Seen" | "Applied" | "Archived";
    dateFound: string;
    companyId: number;
    priority: "high" | "medium" | "low";
    description?: string | undefined;
    salary?: string | null | undefined;
    requirements?: string[] | null | undefined;
    applicationDeadline?: string | null | undefined;
    company?: any;
  };
}

interface FailedJob {
  index: number;
  error: string;
  rawData: unknown;
}

export async function processBatchJobs(rawJobsArray: unknown[]) {
  const results: {
    successful: ProcessedJob[];
    failed: FailedJob[];
  } = {
    successful: [],
    failed: []
  };

  for (let i = 0; i < rawJobsArray.length; i++) {
    try {
      const safeJobData = prepareJobForInsert(rawJobsArray[i]);
      results.successful.push({ index: i, data: safeJobData });
    } catch (error) {
      console.error(`Job ${i} failed validation:`, error);
      results.failed.push({
        index: i,
        error: error instanceof Error ? error.message : "Unknown error",
        rawData: rawJobsArray[i]
      });
    }
  }

  return results;
}


// Example 5: Middleware for Express.js applications
export function jobValidationMiddleware(req: any, res: any, next: any) {
  try {
    // Validate the request body
    const validation = validateJobColumns(req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid job data',
        invalidColumns: validation.invalidColumns,
        validColumns: validation.validColumns
      });
    }

    // Sanitize and prepare the data
    req.safeJobData = prepareJobForInsert(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Job validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Example usage:
// app.post('/jobs', jobValidationMiddleware, (req, res) => {
//   // req.safeJobData is now available and safe to use
//   console.log('Safe job data:', req.safeJobData);
//   res.json({ success: true, job: req.safeJobData });
// });

// Example 6: Integration with existing job scraping system
export function sanitizeScrapedJob(scrapedJobData: any) {
  try {
    // Convert scraped data to our job format
    const rawJobData = {
      title: scrapedJobData.title,
      url: scrapedJobData.job_url || scrapedJobData.url,
      description: scrapedJobData.description,
      companyId: scrapedJobData.company_id,
      matchedKeywords: scrapedJobData.keywords || [],
      salary: scrapedJobData.salary,
      // Remove any extra fields that might have been scraped
      ...scrapedJobData
    };

    // Use our guard utility to ensure only valid data is processed
    return prepareJobForInsert(rawJobData);
  } catch (error) {
    console.error('Failed to sanitize scraped job:', error);
    throw new Error(`Scraped job validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Example test data to demonstrate usage
const demoData = [
  {
    title: 'Frontend Developer',
    url: 'https://company.com/jobs/frontend',
    companyId: 1,
    description: 'Great opportunity for a frontend developer'
  },
  {
    title: 'Backend Engineer',
    url: 'https://company.com/jobs/backend',
    companyId: 2,
    // This will be filtered out by our guard
    'malicious_field': 'DROP TABLE users;',
    'another_bad_field': '<script>alert("xss")</script>'
  },
  {
    // This will fail validation due to missing required fields
    description: 'A job with missing required fields'
  }
];

// Demonstrate the utilities
console.log('=== Job Guard Utilities Demo ===\n');

demoData.forEach((data, index) => {
  console.log(`Processing job ${index + 1}:`);
  
  try {
    const safeData = prepareJobForInsert(data);
    console.log('✅ Success:', safeData);
  } catch (error) {
    console.log('❌ Failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  console.log('---');
});
