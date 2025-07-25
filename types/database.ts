// types/database.ts
import { z } from 'zod';

// Database column mapping - these represent the actual database columns
export const CompanySchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().url(),
  career_page_url: z.string().url(),
  keywords: z.array(z.string()),
  priority: z.enum(['high', 'medium', 'low']),
  check_interval_minutes: z.number().positive(),
  status: z.enum(['active', 'inactive']).default('active'),
  created_at: z.string().datetime(),
  last_checked_at: z.string().datetime().optional(),
});

export const JobSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string().url(),
  matchedKeywords: z.array(z.string()),
  dateFound: z.string().datetime(),
  description: z.string().optional(),
  companyId: z.number(),
  status: z.enum(['New', 'Seen', 'Applied', 'Archived']).default('New'),
  priority: z.enum(['high', 'medium', 'low']),
  salary: z.string().nullable().optional(),
  requirements: z.array(z.string()).nullable().optional(),
  applicationDeadline: z.string().nullable().optional(),
});

// Create input schemas for database operations (omit auto-generated fields)
export const CompanyInsertSchema = CompanySchema.omit({ 
  id: true, 
  created_at: true,
  last_checked_at: true 
});

export const JobInsertSchema = JobSchema.omit({ 
  id: true 
});

export const CompanyUpdateSchema = CompanyInsertSchema.partial();
export const JobUpdateSchema = JobInsertSchema.partial();

// Infer TypeScript types from Zod schemas
export type Company = z.infer<typeof CompanySchema>;
export type Job = z.infer<typeof JobSchema>;
export type CompanyInsert = z.infer<typeof CompanyInsertSchema>;
export type JobInsert = z.infer<typeof JobInsertSchema>;
export type CompanyUpdate = z.infer<typeof CompanyUpdateSchema>;
export type JobUpdate = z.infer<typeof JobUpdateSchema>;

// Additional types for API responses with relationships
export const JobWithCompanySchema = JobSchema.extend({
  company: z.object({
    id: z.number(),
    name: z.string(),
  }),
  companyName: z.string(),
});

export type JobWithCompany = z.infer<typeof JobWithCompanySchema>;

// Validation functions
export function validateCompany(data: unknown): Company {
  return CompanySchema.parse(data);
}

export function validateJob(data: unknown): Job {
  return JobSchema.parse(data);
}

export function validateCompanyInsert(data: unknown): CompanyInsert {
  return CompanyInsertSchema.parse(data);
}

export function validateJobInsert(data: unknown): JobInsert {
  return JobInsertSchema.parse(data);
}

// Database constraint types for additional type safety
export type DatabaseTables = {
  companies: {
    Row: Company;
    Insert: CompanyInsert;
    Update: CompanyUpdate;
  };
  jobs: {
    Row: Job;
    Insert: JobInsert;
    Update: JobUpdate;
  };
};
