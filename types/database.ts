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
   user_id: z.string(),
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
  company: z.any().optional(),
});

// Create input schemas for database operations (omit auto-generated fields)
export const CompanyInsertSchema = CompanySchema.omit({ 
  id: true, 
  created_at: true,
  last_checked_at: true,
  user_id: true, 
});
export type CompanyInsert = {
  name: string;
  url: string;
  career_page_url: string;
  keywords: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'inactive'; 
  check_interval_minutes: number;
  user_id: string; 
};

export const JobInsertSchema = JobSchema.omit({ 
  id: true 
});

export const CompanyUpdateSchema = CompanyInsertSchema.partial();
export const JobUpdateSchema = JobInsertSchema.partial();

// Infer TypeScript types from Zod schemas
export type Company = z.infer<typeof CompanySchema>;
export type Job = z.infer<typeof JobSchema>;
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

export function validateCompanyInsert(data: unknown, userId: string): CompanyInsert {
  const parsed = CompanyInsertSchema.parse(data);
  return { ...parsed, user_id: userId };
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
export type Database = {
  // ...other tables
  companies: {
    Row: {
      id: number;
      created_at: string;
      user_id: string;
      name: string;
      url: string;
      career_page_url: string;
      keywords: string[];
      priority: 'high' | 'medium' | 'low';
      status: 'active' | 'inactive';
      check_interval_minutes: number;
      last_checked_at?: string | null;
    };
    Insert: {
      created_at?: string;
      user_id: string;
      name: string;
      url: string;
      career_page_url: string;
      keywords: string[];
      priority: 'high' | 'medium' | 'low';
      status: 'active' | 'inactive';
      check_interval_minutes: number;
      last_checked_at?: string | null;
    };
    Update: Partial<{
      created_at: string;
      user_id: string;
      name: string;
      url: string;
      career_page_url: string;
      keywords: string[];
      priority: 'high' | 'medium' | 'low';
      status: 'active' | 'inactive';
      check_interval_minutes: number;
      last_checked_at?: string | null;
    }>;
  };
};