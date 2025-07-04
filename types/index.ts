// types/index.ts
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TrackedWebsite {
  id: string;
  user_id: string;
  company_name: string;
  website_url: string;
  careers_page_url: string;
  is_active: boolean;
  check_frequency_hours: number;
  last_checked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface JobAlert {
  id: string;
  user_id: string;
  tracked_website_id: string;
  job_title: string;
  job_description?: string;
  job_url?: string;
  location?: string;
  salary_range?: string;
  employment_type?: string;
  posted_date?: string;
  found_at: string;
  is_read: boolean;
  created_at: string;
  tracked_website?: TrackedWebsite;
}

export interface SavedJob {
  id: string;
  user_id: string;
  job_alert_id?: string;
  job_title: string;
  company_name: string;
  job_url?: string;
  location?: string;
  salary_range?: string;
  employment_type?: string;
  notes?: string;
  tags?: string[];
  saved_at: string;
  created_at: string;
  job_alert?: JobAlert;
}

export type JobStatus = 
  | 'applied' 
  | 'interview_scheduled' 
  | 'interviewing' 
  | 'offer_received' 
  | 'rejected' 
  | 'withdrawn';

export interface Job {
  id: string;
  user_id: string;
  saved_job_id?: string;
  job_title: string;
  company_name: string;
  job_url?: string;
  location?: string;
  salary_range?: string;
  employment_type?: string;
  status: JobStatus;
  application_date?: string;
  interview_date?: string;
  follow_up_date?: string;
  notes?: string;
  cover_letter?: string;
  resume_version?: string;
  contact_person?: string;
  contact_email?: string;
  priority: number;
  created_at: string;
  updated_at: string;
  saved_job?: SavedJob;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'job_alert';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  action_url?: string;
  action_text?: string;
  created_at: string;
}

// Auth related types
export interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
  full_name?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  error?: string;
}

// Form validation types
export interface FormErrors {
  [key: string]: string;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

// API response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  message?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  // Add any other fields relevant to your user profile
}

// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;
      };
      tracked_websites: {
        Row: TrackedWebsite;
        Insert: Omit<TrackedWebsite, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TrackedWebsite, 'id' | 'created_at' | 'updated_at'>>;
      };
      job_alerts: {
        Row: JobAlert;
        Insert: Omit<JobAlert, 'id' | 'created_at'>;
        Update: Partial<Omit<JobAlert, 'id' | 'created_at'>>;
      };
      saved_jobs: {
        Row: SavedJob;
        Insert: Omit<SavedJob, 'id' | 'created_at'>;
        Update: Partial<Omit<SavedJob, 'id' | 'created_at'>>;
      };
      jobs: {
        Row: Job;
        Insert: Omit<Job, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Job, 'id' | 'created_at' | 'updated_at'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>;
      };
    };
  };
}
type ScheduledTask = { start: () => void; stop: () => void; destroy: () => void; getStatus: () => 'scheduled' | 'running' | 'stopped' | 'destroyed'; };

function schedule( expression: string, func: () => void | Promise<void>, options?: ScheduleOptions ): ScheduledTask;

export = { schedule, }; }