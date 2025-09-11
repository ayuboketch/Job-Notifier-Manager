/// server/index.ts - Fixed version with schema corrections and duplicate prevention

import * as dotenv from 'dotenv';
import 'dotenv/config';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// The rest of your imports
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import express, { Request, RequestHandler } from 'express';
import { chromium, Page as PlaywrightPage } from 'playwright';
import {
  Database
} from '../types/database';

type Company = Database['public']['Tables']['companies']['Row'];
type Job = Database['public']['Tables']['jobs']['Row'];

/* ---------- Supabase ---------------------------------------------------- */

const supabaseUrl = process.env['SUPABASE_URL'] ?? process.env['EXPO_PUBLIC_SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ??
                    process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] as string;

if (!supabaseUrl || !supabaseKey)
  throw new Error('Supabase URL or Service Role Key missing');

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

import { z } from 'zod';
type CompanyInsert = Database['public']['Tables']['companies']['Insert'];
type JobInsert = Database['public']['Tables']['jobs']['Insert'];

const GROQ_API_KEY = process.env['GROQ_API_KEY'] || process.env['EXPO_PUBLIC_GROQ_API_KEY'];
const GROQ_API_URL = process.env['GROQ_API_URL'] || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env['GROQ_MODEL'] || 'mixtral-8x7b-32768';
const OPENROUTER_API_KEY = process.env['OPEN_ROUTER_KEY'];

// Return type for scraping functions - DB columns plus transient fields
interface ScrapedJob {
  id?: number;
  title: string;
  url: string;
  matchedKeywords: string[];
  dateFound: string;
  description?: string;
  companyId?: number; // FIXED: Changed from companyId to company_id to match DB schema
  status?: 'New' | 'Seen' | 'Applied' | 'Archived';
  priority?: string;
  salary?: string | null | undefined;
  requirements?: string[] | null;
  // Transient fields that callers can discard
  companyNameTmp?: string;
  applicationDeadlineTmp?: string | null; // Transient field for display only
  duties?: string[];
}

/* ---------- Express app ------------------------------------------------- */
const app = express();
const PORT = Number(process.env['PORT']) || 3000;

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'http://localhost:8081', 
    'exp://192.168.100.88:8081', 
    'http://192.168.100.88:8081',
    'http://localhost:3000',
    /^exp:\/\/.*$/  // Allow all Expo development URLs
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health-detailed', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'],
    port: PORT,
    supabaseConnected: !!supabaseUrl && !!supabaseKey
  });
});

// Add Vercel Cron webhook endpoint for manual triggering
app.post('/api/cron/trigger', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const response = await fetch(`${process.env['VERCEL_URL'] || 'http://localhost:3000'}/api/cron/check-jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env['CRON_SECRET']}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/* ---------- Utility helpers -------------------------------------------- */
const extractCompanyName = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    const parts = domain.replace('www.', '').split('.');
    return parts[0] ?? 'Unknown Company';
  } catch {
    return 'Unknown Company';
  }
};

// Auth middleware to extract user ID from JWT token
const authenticateUser = async (
  req: Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    (req as any).userId = user.id;
    return next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }
};

// Function to detect and validate career page URLs
const findCareerPageUrl = async (baseUrl: string): Promise<string> => {
  const commonPaths = [
    '/careers', '/jobs', '/career', '/opportunities', '/positions',
    '/job-openings', '/work-with-us', '/join-us', '/hiring', '/employment'
  ];

  for (const path of commonPaths) {
    const testUrl = `${baseUrl}${path}`;
    let browser;
    try {
      // browser = await chromium.launch({ headless: true });
      const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-web-security', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();
      const response = await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      if (response && response.ok()) {
        const hasJobContent = await page.evaluate(() => {
          const content = document.body.textContent?.toLowerCase() || '';
          const jobKeywords = [
            'job', 'position', 'career', 'hiring', 'apply', 
            'opportunity', 'employment', 'vacancy', 'role'
          ];
          return jobKeywords.some(keyword => content.includes(keyword));
        });
        
        if (hasJobContent) {
          console.log(`Found valid career page: ${testUrl}`);
          return testUrl;
        }
      }
    } catch (error) {
      console.log(`Failed to access ${testUrl}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        if(browser) await browser.close();
    }
  }
  
  console.log(`No valid career page found, using fallback: ${baseUrl}/careers`);
  return `${baseUrl}/careers`;
};

const convertIntervalToMinutes = (interval: string | undefined): number => {
  if (!interval) return 1440; // Default to 1 day

  const parts = interval.trim().split(" ");
  const value = parts[0];
  const unit = parts[1];

  if (!value || !unit) return 1440;

  const numValue = parseInt(value, 10);
  if (isNaN(numValue)) return 1440;

  switch (unit.toLowerCase()) {
    case "hour": case "hours": return numValue * 60;
    case "day": case "days": return numValue * 60 * 24;
    case "week": case "weeks": return numValue * 60 * 24 * 7;
    default: return 1440;
  }
};

/* ---------- Scraping helpers (Enhanced with better error handling) ----- */
async function scrapeJobs(
  page: PlaywrightPage,
  keywords: string[],
  companyName: string,
  career_page_url: string
): Promise<ScrapedJob[]> {
  let jobs: ScrapedJob[] = [];
  let apiJobs: any[] = [];

  page.on('response', async (response) => {
    try {
      if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
        const contentType = response.headers()['content-type'];
        if (response.ok() && contentType && contentType.includes('application/json')) {
          const json = await response.json();

          const findJobsArray = (data: any): any[] | null => {
            if (Array.isArray(data)) {
              if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
                const firstItem = data[0];
                if (('title' in firstItem || 'jobTitle' in firstItem) && ('url' in firstItem || 'jobUrl' in firstItem)) {
                  return data;
                }
              }
            } else if (typeof data === 'object' && data !== null) {
              for (const key in data) {
                const potentialJobs = findJobsArray(data[key]);
                if (potentialJobs) return potentialJobs;
              }
            }
            return null;
          };
          const foundApiJobs = findJobsArray(json);
          if (foundApiJobs) {
            apiJobs = apiJobs.concat(foundApiJobs);
          }
        }
      }
    } catch (error) {
       console.warn(`Warning: Could not process response from ${response.url()}. It's likely not valid JSON.`);
    }
  });

  try {
    await page.goto(career_page_url, { 
      waitUntil: 'networkidle', 
      timeout: 30000
    });
    
    await page.waitForTimeout(5000);
    try {
        await page.waitForSelector('a[href*="job"], .job-title, [data-job]', { timeout: 10000 });
      } catch (e) {
        console.log('No job selectors found, proceeding with scrape...');
      }
    
  } catch (error) {
    console.log(`Failed to load ${career_page_url}, trying with basic navigation...`);
    try {
      await page.goto(career_page_url, { 
        waitUntil: 'load',
        timeout: 15000 
      });
      await page.waitForTimeout(2000);
    } catch (fallbackError) {
      console.error(`Complete failure to load ${career_page_url}:`, fallbackError);
      throw new Error(`Cannot access ${career_page_url}: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
    }
  }

  if (apiJobs.length > 0) {
    console.log(`Found ${apiJobs.length} jobs via API for ${companyName}`);
    const kwSet = new Set(keywords.map((k) => k.toLowerCase()));
    const uniqueUrls = new Set<string>();

    jobs = apiJobs
      .map((job: any): ScrapedJob | null => {
        const title = job.title || job.jobTitle || '';
        const url = job.url || job.jobUrl || job.absolute_url || '';
        if (!title || !url || uniqueUrls.has(url)) return null;

        const description = job.description || job.jobDescription || '';
        const salary = job.salary || null;
        const applicationDeadline = job.applicationDeadline || null;
        const requirements = job.requirements || null;
        const matched = [...kwSet].filter(k => title.toLowerCase().includes(k));

        uniqueUrls.add(url);
        return {
          title, url, companyNameTmp: companyName, matchedKeywords: [...new Set(matched)],
          dateFound: new Date().toISOString(), description, salary,
          applicationDeadlineTmp: applicationDeadline, requirements,
        };
      })
      .filter((job): job is ScrapedJob => job !== null && (kwSet.size === 0 || job.matchedKeywords.length > 0));
  } else {
    console.log(`No API jobs found for ${companyName}, falling back to HTML scraping.`);
    
    try {
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++) {
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      });

      jobs = await page.evaluate(({ kws, coName }) => {
        const kwSet = new Set(kws.map((k: string) => k.toLowerCase()));
        const seen = new Set<string>();
        const htmlJobs: ScrapedJob[] = [];

        document.querySelectorAll('a[href]').forEach((a) => {
          const anchor = a as HTMLAnchorElement;
          const title = (anchor.textContent || anchor.title || '').trim();
          const url = anchor.href;

          if (!title || !url || seen.has(url)) return;

          const matched = [...kwSet].filter((k: string) => title.toLowerCase().includes(k));
          if (kwSet.size === 0 || matched.length > 0) {
            seen.add(url);
            htmlJobs.push({
              title, url, companyNameTmp: coName, matchedKeywords: [...new Set(matched)],
              dateFound: new Date().toISOString(),
            });
          }
        });
        return htmlJobs;
      }, { kws: keywords, coName: companyName });
    } catch (evalError) {
      console.log(`HTML scraping failed for ${companyName}, returning empty results`);
    }
  }

  return jobs;
}

async function cleanJobsWithAI(jobs: ScrapedJob[]): Promise<ScrapedJob[]> {
  if (!OPENROUTER_API_KEY || jobs.length === 0) return jobs;
  
  const cleanedJobs: ScrapedJob[] = [];
  for (const job of jobs) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [{
            role: 'user',
            content: `Clean this job data. Fix spacing, extract duties/requirements:\nTitle: ${job.title}\nDescription: ${job.description || 'N/A'}\n\nReturn JSON only: {"title": "Clean Title", "description": "Clean description", "duties": ["duty1", "duty2"], "requirements": ["req1", "req2"]}`
          }]
        })
      });
      
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        try {
          const cleaned = JSON.parse(data.choices[0].message.content);
          cleanedJobs.push({...job, ...cleaned});
        } catch (e) {
          console.error('AI cleanup failed to parse JSON:', e);
          cleanedJobs.push(job);
        }
      } else {
        cleanedJobs.push(job);
      }
    } catch (error) {
      console.error('AI cleanup failed:', error);
      cleanedJobs.push(job);
    }
  }
  return cleanedJobs;
}

async function scrapeWithoutAI(company: any): Promise<ScrapedJob[]> {
  console.log(`[SCRAPER] Scraping ${company.name} without AI...`);
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']});
  const page = await browser.newPage();
  
  try {
    await page.goto(company.career_page_url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000);
    try {
      await page.click('button:has-text("Load More"), button:has-text("Show More"), .load-more, .pagination a', { timeout: 3000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('[SCRAPER] No cookie banner found or failed to click');
    }
    
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.scrollTo(0, document.body.scrollHeight); }); // Scroll to load dynamic content
    await page.goto(findCareerPageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(15000);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('div[data-automation-id="jobTitle"], .iCIMS_InfoMsg, .iCIMS_JobsTable', { timeout: 20000 }).catch(() => console.log('ICIMS elements not found'));
    
    const jobsData = await page.evaluate((keywords) => {
      const jobSelectors = [
        'div[data-automation-id="jobTitle"] a', 'a[data-automation-id="job-title"]', 
        '.iCIMS_JobsTable a', 'td.iCIMS_JobsTable a', '.jobTitle a',
        'a[href*="job"]', 'a[href*="career"]', 'a[href*="position"]', 'a[href*="role"]',
        'a[href*="apply"]', '.job-title a', '.position a', '.career a', '[data-job] a',
        '[data-job-id] a', '.job-title a', '.job-link', 'a[href*="searchjobs"]',
        'h1 a, h2 a, h3 a, h4 a', 'a[href*="job"]', 'a[href*="searchjobs"]', 'a[href*="apply"]',
        '.job-title a', '.position a', '.career a', '[data-job] a', '[data-job-id] a'
      ];
      
      const found: Omit<ScrapedJob, 'matchedKeywords' | 'dateFound' | 'companyId'>[] = [];
      const seen = new Set<string>();
      
      jobSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el: Element) => {
          const anchor = el as HTMLAnchorElement;
          const title = (anchor.textContent || anchor.innerText || '').trim();
          const url = anchor.href;
          
          if (!title || !url || seen.has(url) || title.length < 3) return;
          
          const titleLower = title.toLowerCase();
          const isJobRelated = ['engineer', 'developer', 'manager', 'intern', 'specialist', 'analyst', 'coordinator', 'assistant', 'director', 'lead']
            .some(role => titleLower.includes(role)) || keywords.some((kw: string) => titleLower.includes(kw.toLowerCase()));
          
          if (isJobRelated) {
            seen.add(url);
            const parent = el.closest('div, li, tr, article, section') || el.parentElement;
            const parentText = parent?.textContent || '';
            const salaryMatch = parentText.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?|\d+k\s*-\s*\d+k/i);
            const deadlineMatch = parentText.match(/deadline|apply by|closes on[\s:]*([^\n\r,]+)/i);
            
            found.push({
              title,
              url,
              salary: salaryMatch ? salaryMatch[0] : null,
              applicationDeadlineTmp: deadlineMatch?.[1]?.trim() ?? null,
              description: parentText.substring(0, 200) + '...',
              requirements: null
            });
          }
        });
      });
      return found;
    }, company.keywords);
    
    console.log(`[SCRAPER] Found ${jobsData.length} potential jobs for ${company.name}`);
    
    return jobsData.map((job): ScrapedJob => ({
      ...job,
      url: job.url?.startsWith('http') ? job.url : new URL(job.url, company.url).toString(),
      companyNameTmp: company.name,
      companyId: company.id, // FIXED: Changed from companyId to company_id
      dateFound: new Date().toISOString(),
      status: 'New' as const,
      priority: company.priority,
      matchedKeywords: company.keywords.filter((keyword: string) => job.title.toLowerCase().includes(keyword.toLowerCase())),
    }));
    
  } catch (error) {
    console.error(`[SCRAPER] Error scraping ${company.name}:`, error);
    return [];
  } finally {
      await browser.close();
  }
}

/* ---------- Company mapping helpers ----------------------------------- */
let companyNameCache = new Map<number, string>();

async function getCompanyNames(): Promise<Map<number, string>> {
  try {
    const { data: companies, error } = await supabase.from('companies').select('id, name');
    if (error) {
      console.error('Error fetching company names:', error);
      return companyNameCache;
    }
    
    companyNameCache.clear();
    (companies as { id: number; name: string }[] | undefined)?.forEach(company => { companyNameCache.set(company.id, company.name); });
    return companyNameCache;
  } catch (error) {
    console.error('Failed to fetch company names:', error);
    return companyNameCache;
  }
}

function mapJobsWithCompanyNames(jobs: any[], companyNames: Map<number, string>) {
  return jobs.map(job => {
    const companyName = companyNames.get(job.companyId) || 'Unknown Company'; // FIXED: Changed from companyId
    return { ...job, companyName, company: { id: job.companyId, name: companyName } }; // FIXED: Changed from companyId
  });
}

/* ---------- Route Handlers -------------------------------- */
const AddCompanyRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  careerPageUrl: z.string().url('Invalid career page URL').optional(),
  keywords: z.union([z.string(), z.array(z.string())]),
  priority: z.enum(['high', 'medium', 'low']),
  checkInterval: z.string(),
});

// Add a request tracking mechanism to prevent duplicates
const requestTracker = new Map<string, { timestamp: number, processing: boolean }>();

export const addCompanyHandler: RequestHandler<{}, any, CompanyInsert> = async (req, res): Promise<void> => {
  console.log('=== ADD COMPANY REQUEST START ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  const userId = (req as any).userId;
  if (!userId) {
    console.error('No user ID found in request');
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  console.log('User ID:', userId);

  // FIXED: Add duplicate request prevention
  const requestKey = `${userId}-${req.body.url}`;
  const now = Date.now();
  const existingRequest = requestTracker.get(requestKey);

  if (existingRequest && existingRequest.processing && (now - existingRequest.timestamp) < 30000) {
    console.log('Duplicate request detected, ignoring');
    res.status(429).json({ error: 'Request already in progress' });
    return;
  }

  requestTracker.set(requestKey, { timestamp: now, processing: true });

  try {
    const validatedBody = AddCompanyRequestSchema.parse(req.body);
    const { url, keywords, priority, checkInterval } = validatedBody;
    let { careerPageUrl } = validatedBody;

    console.log('Validation passed, processing company data...');

    // FIXED: Check if company already exists for this user
    const name = extractCompanyName(url);
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', userId)
      .eq('url', url)
      .single();

    if (existingCompany) {
      console.log('Company already exists:', existingCompany);
      res.status(409).json({ 
        success: false, 
        error: 'Company already exists',
        company: existingCompany 
      });
      return;
    }

    const keywordsArray = typeof keywords === 'string' 
      ? keywords.split(',').map(kw => kw.trim()).filter(Boolean) 
      : keywords;

    console.log(`Extracted company name: ${name}`);
    console.log(`Keywords array:`, keywordsArray);

    if (!careerPageUrl) {
      console.log('Finding career page URL...');
      careerPageUrl = await findCareerPageUrl(url);
      console.log(`Career page URL: ${careerPageUrl}`);
    }
    
    const companyInsertData: CompanyInsert = {
      name, 
      url, 
      career_page_url: careerPageUrl, 
      keywords: keywordsArray,
      priority, 
      status: 'active',
      check_interval_minutes: convertIntervalToMinutes(checkInterval),
      user_id: userId,
      created_at: new Date().toISOString()
    };

    console.log('Inserting company into database...');
    console.log('Company data:', JSON.stringify(companyInsertData, null, 2));
    
    const { data: companies, error } = await supabase
      .from('companies')
      .insert([companyInsertData])
      .select()
      .single();
 
    if (error || !companies) {
      console.error('Database insert error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add company', 
        detail: error?.message || 'Unknown database error'
      });
      return;
    }

    const company = companies;
    console.log('Company inserted successfully:', company);

    let jobs: ScrapedJob[] = [];
    try {
      console.log('Starting job scraping...');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      jobs = await scrapeJobs(page, keywordsArray, name, careerPageUrl);
      console.log(`Initial scrape found ${jobs.length} jobs`);
      
      if (jobs.length === 0 && keywordsArray.length === 0) {
        console.log('No jobs found with keywords, trying without AI...');
        jobs = await scrapeWithoutAI({ ...company, keywords: keywordsArray });
      }
      
      jobs = await cleanJobsWithAI(jobs);
      await browser.close();
      console.log(`Final job count after AI cleaning: ${jobs.length}`);

      if (jobs.length > 0) {
        console.log('Inserting jobs into database...');
        const jobsToInsert = jobs.map(job => {
          const { companyNameTmp, applicationDeadlineTmp, duties, ...dbJob } = job;
            return { 
              ...dbJob, 
              companyId: company.id,
              priority, 
              status: 'New', 
              matchedKeywords: job.matchedKeywords || [], // CHANGE FROM: matched_keywords
              user_id: userId
            };
          });
        
        const { error: jobError } = await supabase.from('jobs').insert(jobsToInsert);
        if (jobError) {
          console.error('Job insert error:', jobError.message);
        } else {
          console.log(`Successfully inserted ${jobsToInsert.length} jobs`);
        }
      }

      // FIXED: Map jobs for frontend compatibility
      const jobsForResponse = jobs.map(job => ({
        ...job, 
        id: job.id || Date.now() + Math.random(),
        applicationDeadline: job.applicationDeadlineTmp,
        companyId: company.id,
      }));

      const companyNames = new Map([[company.id, name]]);
      const mappedJobs = mapJobsWithCompanyNames(jobsForResponse, companyNames);
      
      console.log('=== ADD COMPANY SUCCESS ===');
      res.json({ 
        success: true, 
        company, 
        jobsFound: jobs.length, 
        jobs: mappedJobs 
      });

    } catch (scrapingError) {
      console.error('Scraping error:', scrapingError);
      res.json({ 
        success: true, 
        company, 
        jobsFound: 0, 
        jobs: [], 
        warning: 'Company added, but job scraping failed: ' + (scrapingError as Error).message
      });
    }
    
  } catch (error) {
    console.error('=== ADD COMPANY ERROR ===');
    console.error('Error details:', error);
    
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.flatten());
      res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: error.flatten() 
      });
      return;
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env['NODE_ENV'] === 'development' ? (error as Error).stack : undefined
    });
  } finally {
    // Clean up request tracker
    requestTracker.delete(`${userId}-${req.body.url}`);
  }
};

const getJobsHandler: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Get company names for mapping
    const companyNames = await getCompanyNames();
    const mappedJobs = mapJobsWithCompanyNames(jobs || [], companyNames);
    
    res.json(mappedJobs);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
};

const getCompaniesHandler: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// Other handlers remain the same...
const deleteCompanyHandler: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = Number(req.params['id']);
    
    await supabase.from('jobs').delete()
      .eq('companyId', id)  // FIXED: Use companyId
      .eq('user_id', userId);
    
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
};

const deleteJobHandler: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = Number(req.params['id']);
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
};

const UpdatePriorityRequestSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']),
});

const updateCompanyPriorityHandler: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params['id']);
    const { priority } = UpdatePriorityRequestSchema.parse(req.body);

    await supabase.from('companies').update({ priority }).eq('id', id);
    await supabase.from('jobs').update({ priority }).eq('companyId', id); // FIXED: Use companyId

    return res.json({ success: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: e.flatten() });
    }
    return res.status(500).json({ success: false, error: e.message });
  }
};

// Debug endpoint
app.get('/api/debug/test-db', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return res.status(500).json({ 
        error: 'Database connection failed', 
        details: error.message 
      });
    }
    
    res.json({ 
      status: 'Database connected', 
      companiesCount: count,
      supabaseUrl: supabaseUrl ? 'Set' : 'Missing',
      supabaseKey: supabaseKey ? 'Set' : 'Missing'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Routes Registration
app.use('/api/companies', authenticateUser);
app.use('/api/jobs', authenticateUser);
app.post('/api/companies', addCompanyHandler);
app.get('/api/companies', getCompaniesHandler);
app.delete('/api/companies/:id', deleteCompanyHandler);
app.put('/api/companies/:id/priority', updateCompanyPriorityHandler);
app.get('/api/jobs', getJobsHandler);
app.delete('/api/jobs/:id', deleteJobHandler);

// Error handling middleware
// app.use((err: any, req: Request, res: express.Response, next: express.NextFunction) => {
//   console.error('Unhandled error:', err);
//   res.status(500).json({ success: false, error: 'Internal server error

// /* ---------- Routes Registration ---------------------------------------- */
// app.use('/api/companies', authenticateUser);
// app.use('/api/jobs', authenticateUser);
// app.post('/api/companies', addCompanyHandler);
// app.post('/api/companies/refresh', refreshAllCompaniesHandler);
// app.get('/api/companies', getCompaniesHandler);
// app.delete('/api/companies/:id', deleteCompanyHandler);
// app.put('/api/companies/:id/priority', updateCompanyPriorityHandler);
// app.get('/api/jobs', getJobsHandler);
// app.delete('/api/jobs/:id', deleteJobHandler);

// Debug and utility endpoints
app.get('/api/debug/schedule', async (req, res) => {
  try {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, last_checked_at, check_interval_minutes, status');
      
    const now = new Date();
    const schedule = companies?.map(company => {
      const lastChecked = company.last_checked_at ? new Date(company.last_checked_at) : null;
      const intervalMinutes = company.check_interval_minutes || 1440;
      const nextCheck = lastChecked ? 
        new Date(lastChecked.getTime() + (intervalMinutes * 60 * 1000)) : 
        new Date();
      
      const isDue = now >= nextCheck;
      const minutesUntilNext = Math.ceil((nextCheck.getTime() - now.getTime()) / (1000 * 60));
      
      return {
        name: company.name,
        status: company.status,
        lastChecked: lastChecked?.toLocaleString() || 'Never',
        intervalHours: Math.round(intervalMinutes / 60),
        nextCheck: nextCheck.toLocaleString(),
        isDue,
        minutesUntilNext: isDue ? 0 : minutesUntilNext
      };
    }) || [];

    res.json({ 
      currentTime: now.toLocaleString(),
      companies: schedule 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/test-db', async (_req, res) => {
  try {
    // Test basic connection
    const { data, error } = await supabase.from('companies').select('count').limit(1);
    
    if (error) {
      return res.status(500).json({ 
        error: 'Database connection failed', 
        details: error.message 
      });
    }
    
    res.json({ 
      status: 'Database connected', 
      supabaseUrl: supabaseUrl ? 'Set' : 'Missing',
      supabaseKey: supabaseKey ? 'Set' : 'Missing'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/api/companies/schedule', async (req, res) => {
  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, last_checked_at, check_interval_minutes, status')
      .eq('status', 'active');
      
    if (error) throw error;

    const now = new Date();
    const schedule = companies?.map(company => {
      const lastChecked = company.last_checked_at ? new Date(company.last_checked_at) : null;
      const intervalMinutes = company.check_interval_minutes || 1440;
      const nextCheck = lastChecked ? 
        new Date(lastChecked.getTime() + (intervalMinutes * 60 * 1000)) : 
        new Date();
      
      const isDue = now >= nextCheck;
      const timeUntilNext = isDue ? 0 : Math.ceil((nextCheck.getTime() - now.getTime()) / (1000 * 60));
      
      return {
        id: company.id,
        name: company.name,
        lastChecked: lastChecked?.toISOString() || 'Never',
        intervalMinutes,
        nextCheck: nextCheck.toISOString(),
        isDue,
        minutesUntilNext: timeUntilNext
      };
    }) || [];

    res.json({ schedule, currentTime: now.toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs/:id/apply', async (req, res) => {
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'Applied', applied_at: new Date().toISOString() })
    .eq('id', req.params.id);
  res.json({ success: !error });
});

app.post('/api/companies/:id/check-now', async (req, res): Promise<void> => {
  try {
    const companyId = Number(req.params.id);
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
      
    if (error || !company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }

    console.log(`[MANUAL] Manual check requested for ${company.name}`);
    
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' });
      
      let foundJobs = await scrapeJobs(page, company.keywords, company.name, company.career_page_url);
      if (foundJobs.length === 0) {
        foundJobs = await scrapeWithoutAI(company);
      }

      const { data: existingJobs } = await supabase.from('jobs').select('url').eq('companyId', company.id);
      const existingUrls = new Set(existingJobs?.map(e => e.url));
      const newJobs = foundJobs.filter(f => f.url && !existingUrls.has(f.url));
      
      if (newJobs.length > 0) { // No change needed here, newJobs.length is a number
        const jobsToInsert = newJobs.map(job => {
          const { companyNameTmp, applicationDeadlineTmp, duties, ...dbJob } = job;
          return { ...dbJob, companyId: company.id, priority: company.priority, status: 'New' };
        });
        await supabase.from('jobs').insert(jobsToInsert);
      }
      
      await supabase.from('companies').update({ 
        last_checked_at: new Date().toISOString() 
      }).eq('id', company.id);
      
      res.json({ 
        success: true, 
        company: company.name,
        newJobs: newJobs.length,
        totalJobs: foundJobs.length 
      });
      
    } finally {
      if (browser) await browser.close();
    }
  } catch (error: any) {
    console.error('[MANUAL] Error in manual check:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Error handling middleware ---------------------------------- */
app.use((err: any, req: Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

/* ---------- Server startup ------------------------------------ */
if (process.env['NODE_ENV'] !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Mobile access: http://192.168.100.88:${PORT}`); 
    console.log(`Health check: http://192.168.100.88:${PORT}/health`);
    console.log('Note: Cron jobs are now handled by Vercel. Deploy to enable automatic job checking.');
  });
}

export { app, cleanJobsWithAI, scrapeJobs, scrapeWithoutAI, type ScrapedJob };
