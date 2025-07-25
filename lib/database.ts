// lib/database.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  Company, 
  Job, 
  CompanyInsert, 
  JobInsert,
  CompanyUpdate,
  JobUpdate,
  validateCompany,
  validateJob,
  validateCompanyInsert,
  validateJobInsert,
  DatabaseTables 
} from '../types/database';

// Type-safe database operations
export class TypeSafeDatabase {
  private supabase: SupabaseClient<{ public: { Tables: DatabaseTables } }>;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<{ public: { Tables: DatabaseTables } }>(supabaseUrl, supabaseKey);
  }

  // Company operations
  async insertCompany(data: CompanyInsert): Promise<{ data: Company | null; error: any }> {
    try {
      // Validate data before inserting
      const validatedData = validateCompanyInsert(data);
      
      const { data: result, error } = await this.supabase
        .from('companies')
        .insert([validatedData])
        .select()
        .single();
      
      if (error) {
        return { data: null, error };
      }
      
      // Validate the returned data
      const validatedResult = validateCompany(result);
      return { data: validatedResult, error: null };
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
