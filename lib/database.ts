// lib/database.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Use these for type safety:
type Company = Database['public']['Tables']['companies']['Row'];
type CompanyInsert = Database['public']['Tables']['companies']['Insert'];
type CompanyUpdate = Database['public']['Tables']['companies']['Update'];
type Job = Database['public']['Tables']['jobs']['Row'];
type JobInsert = Database['public']['Tables']['jobs']['Insert'];
type JobUpdate = Database['public']['Tables']['jobs']['Update'];

// Type-safe database operations
export class TypeSafeDatabase {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }

  // Company operations
  async insertCompany(data: CompanyInsert): Promise<{ data: Company | null; error: any }> {
    try {
      const { data: result, error } = await this.supabase
        .from('companies')
        .insert([data])
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }
      return { data: result, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async updateCompany(id: number, data: CompanyUpdate): Promise<{ data: Company | null; error: any }> {
    try {
      const { data: result, error } = await this.supabase
        .from('companies')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResult = validateCompany(result);
      return { data: validatedResult, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async getCompany(id: number): Promise<{ data: Company | null; error: any }> {
    try {
      const { data: result, error } = await this.supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResult = validateCompany(result);
      return { data: validatedResult, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async getAllCompanies(): Promise<{ data: Company[] | null; error: any }> {
    try {
      const { data: result, error } = await this.supabase
        .from('companies')
        .select('*');
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResults = result?.map(item => validateCompany(item)) || [];
      return { data: validatedResults, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async deleteCompany(id: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('companies')
      .delete()
      .eq('id', id);
    
    return { error };
  }

  // Job operations
  async insertJob(data: JobInsert): Promise<{ data: Job | null; error: any }> {
    try {
      const validatedData = validateJobInsert(data);
      
      const { data: result, error } = await this.supabase
        .from('jobs')
        .insert([validatedData])
        .select()
        .single();
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResult = validateJob(result);
      return { data: validatedResult, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async insertMultipleJobs(data: JobInsert[]): Promise<{ data: Job[] | null; error: any }> {
    try {
      const validatedData = data.map(item => validateJobInsert(item));
      
      const { data: result, error } = await this.supabase
        .from('jobs')
        .insert(validatedData)
        .select();
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResults = result?.map(item => validateJob(item)) || [];
      return { data: validatedResults, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async updateJob(id: number, data: JobUpdate): Promise<{ data: Job | null; error: any }> {
    try {
      const { data: result, error } = await this.supabase
        .from('jobs')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResult = validateJob(result);
      return { data: validatedResult, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async getJob(id: number): Promise<{ data: Job | null; error: any }> {
    try {
      const { data: result, error } = await this.supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResult = validateJob(result);
      return { data: validatedResult, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async getAllJobs(): Promise<{ data: Job[] | null; error: any }> {
    try {
      const { data: result, error } = await this.supabase
        .from('jobs')
        .select('*');
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResults = result?.map(item => validateJob(item)) || [];
      return { data: validatedResults, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async getJobsByCompany(companyId: number): Promise<{ data: Job[] | null; error: any }> {
    try {
      const { data: result, error } = await this.supabase
        .from('jobs')
        .select('*')
        .eq('companyId', companyId);
      
      if (error) {
        return { data: null, error };
      }
      
      const validatedResults = result?.map(item => validateJob(item)) || [];
      return { data: validatedResults, error: null };
    } catch (validationError) {
      return { data: null, error: validationError };
    }
  }

  async deleteJob(id: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('jobs')
      .delete()
      .eq('id', id);
    
    return { error };
  }

  async deleteJobsByCompany(companyId: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('jobs')
      .delete()
      .eq('companyId', companyId);
    
    return { error };
  }

  // Type-safe queries with joins
  async getJobsWithCompanyInfo(): Promise<{ data: (Job & { company: Pick<Company, 'id' | 'name'> })[] | null; error: any }> {
    try {
      const { data: jobs, error: jobsError } = await this.getAllJobs();
      if (jobsError || !jobs) {
        return { data: null, error: jobsError };
      }

      const { data: companies, error: companiesError } = await this.getAllCompanies();
      if (companiesError || !companies) {
        return { data: null, error: companiesError };
      }

      const companyMap = new Map(companies.map(c => [c.id, { id: c.id, name: c.name }]));
      
      const result = jobs.map(job => ({
        ...job,
        company: companyMap.get(job.companyId) || { id: job.companyId, name: 'Unknown Company' }
      }));

      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // Get the raw Supabase client for advanced operations
  getRawClient() {
    return this.supabase;
  }
}

// Create a singleton instance
let dbInstance: TypeSafeDatabase | null = null;

export function getDatabase(supabaseUrl?: string, supabaseKey?: string): TypeSafeDatabase {
  if (!dbInstance) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Database not initialized. Provide supabaseUrl and supabaseKey.');
    }
    dbInstance = new TypeSafeDatabase(supabaseUrl, supabaseKey);
  }
  return dbInstance;
}

// Export for direct usage
export default TypeSafeDatabase;
function validateCompanyInsert(
  data: {
    career_page_url?: string | null;
    careerpageurl?: string | null;
    check_interval?: number | null;
    check_interval_minutes?: number | null;
    created_at?: string | null;
    id?: number;
    keywords?: string[] | null;
    last_checked?: string | null;
    last_checked_at?: string | null;
    name: string;
    priority?: string | null;
    status?: string | null;
    url?: string | null;
    user_id?: string | null;
  },
  user_id: string | null | undefined
) {
  // Ensure required fields
  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Company name is required and must be a string.');
  }
  if (!user_id || typeof user_id !== 'string') {
    throw new Error('user_id is required and must be a string.');
  }

  // Normalize fields
  const normalized: typeof data = {
    ...data,
    user_id,
    // Prefer career_page_url, fallback to careerpageurl
    career_page_url: data.career_page_url ?? data.careerpageurl ?? null,
    check_interval: data.check_interval ?? data.check_interval_minutes ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
    keywords: Array.isArray(data.keywords) ? data.keywords : null,
    last_checked: data.last_checked ?? data.last_checked_at ?? null,
    priority: data.priority ?? null,
    status: data.status ?? null,
    url: data.url ?? null,
  };

  // Remove deprecated/duplicate fields
  delete (normalized as any).careerpageurl;
  delete (normalized as any).check_interval_minutes;
  delete (normalized as any).last_checked_at;

  return normalized;
}

function validateCompany(company: Company): Company {
  // Here you would add validation logic if needed, e.g., using Zod.
  // For now, we'll just return the company as is, assuming Supabase returns valid data.
  // If you want to enforce stricter types or transformations, this is the place.
  return company;
}

function validateJob(item: { application_deadline: string | null; companyId: number | null; created_at: string | null; dateFound: string | null; description: string | null; duties: string[] | null; id: number; matchedKeywords: string[] | null; priority: string | null; requirements: string[] | null; salary: string | null; status: string | null; title: string; url: string; user_id: string | null; }): any {
  throw new Error('Function not implemented.');
}
function validateJobInsert(data: { application_deadline?: string | null; companyId?: number | null; created_at?: string | null; dateFound?: string | null; description?: string | null; duties?: string[] | null; id?: number; matchedKeywords?: string[] | null; priority?: string | null; requirements?: string[] | null; salary?: string | null; status?: string | null; title: string; url: string; user_id?: string | null; }) {
  throw new Error('Function not implemented.');
}

