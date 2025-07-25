// server/index.ts

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// The rest of your imports
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import express, { Request, RequestHandler } from 'express';
import * as cron from 'node-cron';
import { chromium } from 'playwright';
import { z } from 'zod';
import { 
  Company, 
  Job, 
  CompanyInsert, 
  JobInsert,
  validateCompanyInsert,
  validateJobInsert,
  CompanySchema,
  JobSchema,
  DatabaseTables
} from '../types/database';

interface AuthRequest extends Request {
    user?: any;
}

/* ---------- Supabase ---------------------------------------------------- */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Service Role Key is missing from .env. Check server configuration.');
}
const supabase = createClient<{ public: { Tables: DatabaseTables } }>(supabaseUrl, supabaseKey);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'mixtral-8x7b-32768';

/* ---------- Domain types now imported from database.ts -------------- */
// Company and Job interfaces are now imported from types/database.ts
// This ensures type safety with the actual database schema

// Return type for scraping functions - DB columns plus transient fields
interface ScrapedJob {
  id?: number;
  title: string;
  url: string;
  matchedKeywords: string[];
  dateFound: string;
  description?: string;
  companyId?: number;
  status?: 'New' | 'Seen' | 'Applied' | 'Archived';
  priority?: string;
  salary?: string | null;
  requirements?: string[] | null;
  // Transient fields that callers can discard
  companyNameTmp?: string;
  applicationDeadlineTmp?: string | null; // Transient field for display only
}

/* ---------- Express app ------------------------------------------------- */
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:8081', 'exp://192.168.100.88:8081', 'http://192.168.100.88:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

/* ---------- Utility helpers -------------------------------------------- */
const extractCompanyName = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').split('.')[0];
  } catch {
    return 'Unknown Company';
  }
};

// TypeScript helper to remove fields that shouldn't be stored in DB
const stripDbExtras = (job: Partial<Job>): Omit<Partial<Job>, 'company'> => {
  const { company, ...cleanJob } = job;
  return cleanJob;
};

// Function to detect and validate career page URLs
const findCareerPageUrl = async (baseUrl: string): Promise<string> => {
  const commonPaths = [
    '/careers',
    '/jobs', 
    '/career',
    '/opportunities',
    '/positions',
    '/job-openings',
    '/work-with-us',
    '/join-us',
    '/hiring',
    '/employment'
  ];
  
  // Test each common path
  for (const path of commonPaths) {
    const testUrl = `${baseUrl}${path}`;
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      const response = await page.goto(testUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 10000 
      });
      
      if (response && response.ok()) {
        // Check if the page contains job-related content
        const hasJobContent = await page.evaluate(() => {
          const content = document.body.textContent?.toLowerCase() || '';
          const jobKeywords = [
            'job', 'position', 'career', 'hiring', 'apply', 
            'opportunity', 'employment', 'vacancy', 'role'
          ];
          return jobKeywords.some(keyword => content.includes(keyword));
        });
        
        await browser.close();
        
        if (hasJobContent) {
          console.log(`✅ Found valid career page: ${testUrl}`);
          return testUrl;
        }
      }
      
      await browser.close();
    } catch (error) {
      console.log(`❌ Failed to access ${testUrl}: ${error}`);
      continue;
    }
  }
  
  // Fallback to /careers if no valid page found
  console.log(`⚠️ No valid career page found, using fallback: ${baseUrl}/careers`);
  return `${baseUrl}/careers`;
};

const convertIntervalToMinutes = (interval: string): number => {
    if (!interval) return 1440; // Default to 1 day
    const [value, unit] = interval.split(' ');
    const numValue = parseInt(value, 10);
    if(isNaN(numValue)) return 1440;
    switch (unit) {
        case 'hour': case 'hours': return numValue * 60;
        case 'day': case 'days': return numValue * 60 * 24;
        case 'week': case 'weeks': return numValue * 60 * 24 * 7;
        default: return 1440;
    }
}

/* ---------- Scraping helpers (Enhanced with better error handling) ----- */
async function scrapeJobs(
  page: import('playwright').Page,
  keywords: string[],
  companyName: string,
  career_page_url: string
): Promise<ScrapedJob[]> {
  let jobs: ScrapedJob[] = [];
  let apiJobs: any[] = [];

  // Intercept network requests to find API calls returning JSON
  page.route('**/*', async route => {
    try {
      const response = await route.fetch();
      const headers = response.headers();
      const contentType = headers['content-type'];

      if (response.ok() && contentType && typeof contentType === 'string' && contentType.includes('application/json')) {
        let json;
        try {
          const responseText = await response.text();
          if (!responseText.trim()) {
            return route.continue(); // Skip empty responses
          }
          json = JSON.parse(responseText);
        } catch (jsonError) {
          // This is expected for non-JSON responses like tracking pixels. Log it and continue.
          // console.warn(`Warning: Could not parse JSON from ${route.request().url()}. It's likely a tracking script.`);
          return route.continue();
        }

        // Heuristic: Look for arrays of objects that might be job listings
        if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object' && json[0] !== null) {
          // Further heuristic: Check for common job-related keys
          const firstItem = json[0];
          if (('title' in firstItem || 'jobTitle' in firstItem) && ('url' in firstItem || 'jobUrl' in firstItem)) {
            apiJobs = apiJobs.concat(json);
          }
        } else if (typeof json === 'object' && json !== null) {
          // Handle cases where the JSON might be an object containing a jobs array
          for (const key in json) {
            if (Array.isArray(json[key]) && json[key].length > 0 && typeof json[key][0] === 'object') {
              const firstItem = json[key][0];
              if (('title' in firstItem || 'jobTitle' in firstItem) && ('url' in firstItem || 'jobUrl' in firstItem)) {
                apiJobs = apiJobs.concat(json[key]);
              }
            }
          }
        }
      }
      route.continue();
    } catch (error) {
      console.error(`Error during route interception (URL: ${route.request().url()}):`, error);
      route.continue();
    }
  });

  await page.goto(career_page_url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for a bit to allow potential API calls to complete
  await new Promise(resolve => setTimeout(resolve, 5000));

  // If API jobs were found, process them
  if (apiJobs.length > 0) {
    console.log(`Found ${apiJobs.length} jobs via API for ${companyName}`);
    const kwSet = new Set(keywords.map((k) => k.toLowerCase()));
    jobs = apiJobs.map((job: any) => {
      const title = job.title || job.jobTitle || '';
      const url = job.url || job.jobUrl || '';
      const description = job.description || job.jobDescription || '';
      const salary = job.salary || null;
      const applicationDeadline = job.applicationDeadline || null;
      const requirements = job.requirements || null;

      const matched = [...kwSet].filter(k => title.toLowerCase().includes(k));

      return {
        title,
        url,
        companyNameTmp: companyName,
        matchedKeywords: [...new Set(matched)],
        dateFound: new Date().toISOString(),
        description,
        salary,
        applicationDeadlineTmp: applicationDeadline,
        requirements,
      };
    }).filter(job => kwSet.size === 0 || job.matchedKeywords.length > 0);
  } else {
    // Fallback to HTML scraping if no API jobs were found
    console.log(`No API jobs found for ${companyName}, falling back to HTML scraping.`);
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    jobs = await page.evaluate(({ kws, coName }) => {
      const kwSet = new Set(kws.map((k) => k.toLowerCase()));
      const seen = new Set<string>();
      const htmlJobs: ScrapedJob[] = [];

      document.querySelectorAll('a[href]').forEach((a) => {
        const anchor = a as HTMLAnchorElement;
        const title = (anchor.textContent || anchor.title || '').trim();
        const url = anchor.href;

        if (!title || !url || seen.has(url)) return;

        const matched = [...kwSet].filter(k => title.toLowerCase().includes(k));
        if (kwSet.size === 0 || matched.length > 0) {
          seen.add(url);
          htmlJobs.push({
            title,
            url,
            companyNameTmp: coName,
            matchedKeywords: [...new Set(matched)],
            dateFound: new Date().toISOString(),
          });
        }
      });
      return htmlJobs;
    }, { kws: keywords, coName: companyName });
  }

  return jobs;
}

// async function scrapeWithAI(company: Company): Promise<Partial<Job>[]> {
//   console.log(`[AI] Scraping ${company.name} with AI...`);
  
//   const browser = await chromium.launch({ 
//     headless: false,
//     args: [
//       '--no-sandbox', 
//       '--disable-blink-features=AutomationControlled',
//       '--disable-web-security',
//       '--disable-features=VizDisplayCompositor'
//     ]
//   });
  
//   const page = await browser.newPage();
  
//   await page.setExtraHTTPHeaders({
//     'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//     'Accept-Language': 'en-US,en;q=0.5',
//     'Accept-Encoding': 'gzip, deflate',
//     'DNT': '1',
//     'Connection': 'keep-alive',
//     'Upgrade-Insecure-Requests': '1',
//   });
  
//   try {
//     console.log(`[AI] Navigating to ${company.career_page_url}...`);
//     await page.goto(company.career_page_url, { 
//       waitUntil: 'networkidle', 
//       timeout: 60000 
//     });
    
//     console.log(`[AI] Waiting for content to load...`);
//     await page.waitForTimeout(8000);
    
//     await page.evaluate(() => {
//       window.scrollTo(0, document.body.scrollHeight);
//     });
//     await page.waitForTimeout(3000);
    
//     const html = await page.content();
//     console.log(`[AI] HTML length: ${html.length}`);
//     console.log(`[AI] Contains job-related content: ${html.toLowerCase().includes('job') || html.toLowerCase().includes('position') || html.toLowerCase().includes('career')}`);
    
//     await browser.close();
    
//     if (html.length < 5000) {
//       console.log(`[AI] HTML too short (${html.length} chars), might be blocked or not loaded`);
//       return [];
//     }

//     // Split HTML into chunks to avoid token limits
//     const maxChunkSize = 15000; // Reduced chunk size for safety
//     const htmlChunks = [];
    
//     for (let i = 0; i < html.length; i += maxChunkSize) {
//       htmlChunks.push(html.substring(i, i + maxChunkSize));
//     }
    
//     console.log(`[AI] Split HTML into ${htmlChunks.length} chunks`);
    
//     let allJobs: any[] = [];
    
//     // Process each chunk
//     for (let i = 0; i < htmlChunks.length; i++) {
//       console.log(`[AI] Processing chunk ${i + 1}/${htmlChunks.length}...`);
      
//       const prompt = `
// You are a job listing extractor. Extract job listings from this HTML chunk that match keywords: [${company.keywords.join(', ')}].

// Look for job titles, descriptions, and job-related content. Include jobs that seem relevant.

// Return ONLY a JSON array of objects with these exact keys:
// - "title": Job title (required)
// - "description": Brief description or null
// - "salary": Salary range or null  
// - "applicationDeadline": Deadline or null
// - "requirements": Array of skills or null
// - "url": Application link or null

// Example: [{"title":"Software Engineer","description":"Build apps","salary":null,"applicationDeadline":null,"requirements":["React"],"url":"/apply/123"}]

// If no jobs found, return: []

// HTML chunk:
// ${htmlChunks[i]}`;

//       try {
//         const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
//           method: 'POST',
//           headers: {
//             'Authorization': `Bearer ${GROQ_API_KEY}`,
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({
//             model: 'llama3-8b-8192', // Use smaller model to avoid limits
//             messages: [{ role: 'user', content: prompt }],
//             temperature: 0,
//             max_tokens: 2000,
//           }),
//         });

//         const data = await response.json();
        
//         if (response.ok && data.choices && data.choices[0]?.message) {
//           let cleanedContent = data.choices[0].message.content.trim();
          
//           // Clean markdown formatting
//           if (cleanedContent.startsWith('```json')) {
//             cleanedContent = cleanedContent.replace(/```json\n?/, '').replace(/\n?```$/, '');
//           } else if (cleanedContent.startsWith('```')) {
//             cleanedContent = cleanedContent.replace(/```\n?/, '').replace(/\n?```$/, '');
//           }
          
//           try {
//             const jobs = JSON.parse(cleanedContent);
//             if (Array.isArray(jobs)) {
//               allJobs = allJobs.concat(jobs);
//               console.log(`[AI] Chunk ${i + 1}: Found ${jobs.length} jobs`);
//             }
//           } catch (parseError) {
//             console.log(`[AI] Chunk ${i + 1}: Failed to parse JSON, skipping`);
//           }
//         } else {
//           console.log(`[AI] Chunk ${i + 1}: API error:`, data.error?.message || 'Unknown error');
//         }
        
//         // Rate limiting - wait between requests
//         if (i < htmlChunks.length - 1) {
//           await new Promise(resolve => setTimeout(resolve, 2000));
//         }
        
//       } catch (error) {
//         console.log(`[AI] Chunk ${i + 1}: Request failed:`, error);
//       }
//     }
    
//     console.log(`[AI] Total jobs found across all chunks: ${allJobs.length}`);
    
//     // Remove duplicates and process results
//     const uniqueJobs = allJobs.filter((job, index, self) => 
//       index === self.findIndex(j => j.title === job.title && j.url === job.url)
//     );
    
//     console.log(`[AI] Unique jobs after deduplication: ${uniqueJobs.length}`);
    
//     return uniqueJobs.map((job: any) => ({
//       title: job.title || 'Unknown Position',
//       description: job.description || null,
//       salary: job.salary || null,
//       applicationDeadline: job.applicationDeadline || null,
//       requirements: job.requirements || null,
//       url: job.url?.startsWith('http') ? job.url : `${company.url}${job.url || ''}`,
//       company: company.name,
//       companyId: company.id,
//       dateFound: new Date().toISOString(),
//       status: 'New' as const,
//       priority: company.priority,
//       matchedKeywords: company.keywords.filter(keyword => 
//         job.title?.toLowerCase().includes(keyword.toLowerCase()) ||
//         job.description?.toLowerCase().includes(keyword.toLowerCase())
//       ),
//     }));
    
//   } catch (error) {
//     console.error(`[AI] Error during scraping: ${error}`);
//     await browser.close();
//     return [];
//   }
// }
async function scrapeWithoutAI(company: Company): Promise<ScrapedJob[]> {
  console.log(`[SCRAPER] Scraping ${company.name} without AI...`);
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto(company.career_page_url, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Handle cookie acceptance
    try {
      await page.click('button:has-text("Accept"), button:has-text("OK"), button:has-text("Agree"), [id*="cookie"] button, [class*="cookie"] button', { timeout: 3000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('[SCRAPER] No cookie banner found or failed to click');
    }
    
    // Scroll to load more content
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        window.scrollTo(0, document.body.scrollHeight);
      }
    });
    await page.waitForTimeout(5000);
    
    // Extract jobs using multiple selectors
    const jobs = await page.evaluate((keywords) => {
      const jobSelectors = [
        'a[href*="job"]',
        'a[href*="career"]', 
        'a[href*="position"]',
        'a[href*="role"]',
        'a[href*="apply"]',
        '.job-title a',
        '.position a',
        '.career a',
        '[data-job] a',
        'h1 a, h2 a, h3 a, h4 a' // Headers that might be job titles
      ];
      
      const found: any[] = [];
      const seen = new Set<string>();
      
      jobSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el: any) => {
          const title = (el.textContent || el.innerText || '').trim();
          const url = el.href;
          
          if (!title || !url || seen.has(url) || title.length < 3) return;
          
          // Check if title contains job-related words or keywords
          const titleLower = title.toLowerCase();
          const isJobRelated = titleLower.includes('engineer') || 
                             titleLower.includes('developer') || 
                             titleLower.includes('manager') || 
                             titleLower.includes('intern') || 
                             titleLower.includes('specialist') || 
                             titleLower.includes('analyst') || 
                             titleLower.includes('coordinator') ||
                             titleLower.includes('assistant') ||
                             titleLower.includes('director') ||
                             titleLower.includes('lead') ||
                             keywords.some((kw: string) => titleLower.includes(kw.toLowerCase()));
          
          if (isJobRelated) {
            seen.add(url);
            
            // Try to find salary and other details nearby
            const parent = el.closest('div, li, tr, article, section') || el.parentElement;
            const parentText = parent?.textContent || '';
            
            const salaryMatch = parentText.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?|\d+k\s*-\s*\d+k/i);
            const deadlineMatch = parentText.match(/deadline|apply by|closes on[\s:]*([^\n\r,]+)/i);
            
            found.push({
              title,
              url,
              salary: salaryMatch ? salaryMatch[0] : null,
              applicationDeadlineTmp: deadlineMatch ? deadlineMatch[1]?.trim() : null,
              description: parentText.substring(0, 200) + '...',
              requirements: null
            });
          }
        });
      });
      
      return found;
    }, company.keywords);
    
    await browser.close();
    
    console.log(`[SCRAPER] Found ${jobs.length} potential jobs`);
    
    return jobs.map((job: any) => ({
      title: job.title,
      description: job.description,
      salary: job.salary,
      applicationDeadlineTmp: job.applicationDeadlineTmp,
      requirements: job.requirements,
      url: job.url?.startsWith('http') ? job.url : `${company.url}${job.url}`,
      companyNameTmp: company.name,
      companyId: company.id,
      dateFound: new Date().toISOString(),
      status: 'New' as const,
      priority: company.priority,
      matchedKeywords: company.keywords.filter(keyword => 
        job.title?.toLowerCase().includes(keyword.toLowerCase())
      ),
    }));
    
  } catch (error) {
    console.error(`[SCRAPER] Error: ${error}`);
    await browser.close();
    return [];
  }
};

/* ---------- Company mapping helpers ----------------------------------- */
// In-memory company name cache for efficient lookups
let companyNameCache = new Map<number, string>();

// Function to fetch and cache company names
async function getCompanyNames(): Promise<Map<number, string>> {
  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name');
    
    if (error) {
      console.error('Error fetching company names:', error);
      return companyNameCache; // Return existing cache on error
    }
    
    // Update cache
    companyNameCache.clear();
    companies?.forEach(company => {
      companyNameCache.set(company.id, company.name);
    });
    
    return companyNameCache;
  } catch (error) {
    console.error('Failed to fetch company names:', error);
    return companyNameCache;
  }
}

// Function to map jobs with company names attached via relationship
function mapJobsWithCompanyNames(jobs: any[], companyNames: Map<number, string>) {
  return jobs.map(job => {
    const companyName = companyNames.get(job.companyId) || 'Unknown Company';
    return {
      ...job,
      companyName, // New derived field
      company: { // Nested company object
        id: job.companyId,
        name: companyName
      }
    };
  });
}

/* ---------- Route Handlers (Enhanced with better error handling) ------- */
// API request validation schemas
const AddCompanyRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  careerPageUrl: z.string().url('Invalid career page URL').optional(),
  keywords: z.union([z.string(), z.array(z.string())]),
  priority: z.enum(['high', 'medium', 'low']),
  checkInterval: z.string(),
});

const UpdatePriorityRequestSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']),
});

export const addCompanyHandler: RequestHandler = async (req, res) => {
  try {
    // Validate request body
    const validatedBody = AddCompanyRequestSchema.parse(req.body);
    const { url, careerPageUrl, keywords, priority, checkInterval } = validatedBody;

    const name = extractCompanyName(url);
    const createdAt = new Date().toISOString();
    const checkIntervalMinutes = convertIntervalToMinutes(checkInterval);
    const keywordsArray = typeof keywords === 'string' 
      ? keywords.split(',').map(kw => kw.trim()).filter(kw => kw.length > 0) 
      : keywords;

    // Validate the complete company data before inserting
    const companyInsertData: CompanyInsert = {
      name,
      url,
      career_page_url: careerPageUrl || `${url}/careers`,
      keywords: keywordsArray,
      priority,
      check_interval_minutes: checkIntervalMinutes,
      status: 'active',
    };

    // Validate with Zod schema
    const validatedCompanyData = validateCompanyInsert(companyInsertData);

  // Improve career page URL detection
  let finalCareerPageUrl = careerPageUrl;
  if (!finalCareerPageUrl) {
    console.log(`🔍 No career page URL provided, auto-detecting for ${url}...`);
    try {
      finalCareerPageUrl = await findCareerPageUrl(url);
    } catch (error) {
      console.log(`⚠️ Career page detection failed, using fallback: ${url}/careers`);
      finalCareerPageUrl = `${url}/careers`;
    }
  }

  const { data: company, error } = await supabase
    .from('companies')
    .insert([{ 
      name, 
      url, 
      career_page_url: finalCareerPageUrl, 
      keywords: keywordsArray, 
      priority, 
      check_interval_minutes: checkIntervalMinutes,
      created_at: createdAt
    }])
    .select()
    .single();

  if (error || !company) {
    console.error('Supabase insert error:', error);
    res.status(500).json({ error: 'Failed to add company', detail: error?.message });
    return;
  }

  let jobs: ScrapedJob[] = [];
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    jobs = await scrapeJobs(page, keywordsArray, name, finalCareerPageUrl);
    await browser.close();

    if (jobs.length === 0) {
      jobs = await scrapeWithoutAI(company as Company);
    }

    if (jobs.length > 0) {
      const jobsToInsert = jobs.map(job => {
        const { companyNameTmp, applicationDeadlineTmp, ...dbJob } = job;
        return { ...dbJob, companyId: company.id, priority, status: 'New' };
      });
      const { error: jobError } = await supabase.from('jobs').insert(jobsToInsert);
      if (jobError) console.error('Job insert error:', jobError.message);
    }

    // Create mapped jobs with consistent company name format
    const jobsForResponse = jobs.map(job => ({
      id: job.id || Date.now() + Math.random(), // Temporary ID for new jobs
      title: job.title,
      url: job.url,
      matchedKeywords: job.matchedKeywords || [],
      dateFound: job.dateFound,
      description: job.description,
      applicationDeadline: job.applicationDeadlineTmp, // Use transient field for API response
      companyId: job.companyId || company.id,
      status: job.status || 'New',
      priority: job.priority || priority,
      salary: job.salary,
      requirements: job.requirements
    }));
    
    // Apply company name mapping for consistent format
    const companyNames = new Map([[company.id, name]]);
    const mappedJobs = mapJobsWithCompanyNames(jobsForResponse, companyNames);

    res.json({ success: true, company, jobsFound: jobs.length, jobs: mappedJobs });
  } catch (err) {
    console.error('Scraping error:', err);
    res.json({
      success: true,
      company,
      jobsFound: 0,
      jobs: [],
      warning: 'Company added, but job scraping failed.',
    });
  }
  } catch (error) {
    console.error('Error in addCompanyHandler:', error);
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: errorMessages,
        issues: error.issues
      });
    }
    
    // Handle other errors
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

const getCompaniesHandler: RequestHandler = async (_req, res) => {
  try {
    console.log('Fetching companies...');
    const { data, error } = await supabase.from('companies').select('*');
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    console.log(`Found ${data?.length || 0} companies`);
    res.json(data || []);
  } catch (e: any) {
    console.error('Error in getCompaniesHandler:', e);
    res.status(500).json({ success: false, error: e.message });
  }
};

const deleteCompanyHandler: RequestHandler = async (req, res) => {
    try {
        const id = Number(req.params.id);
        console.log(`Deleting company ${id}...`);
        
        // Delete associated jobs first
        await supabase.from('jobs').delete().eq('companyId', id);
        
        // Delete company
        const { error } = await supabase.from('companies').delete().eq('id', id);
        if (error) throw error;
        
        console.log(`Company ${id} deleted successfully`);
        res.json({ success: true });
    } catch (e: any) {
        console.error('Error in deleteCompanyHandler:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

const getJobsHandler: RequestHandler = async (_req, res) => {
    try {
        console.log('Fetching jobs with company names...');
        
        // Fetch jobs from database
        const { data: jobs, error } = await supabase.from('jobs').select('*');
        if (error) {
            console.error('Database error:', error);
            throw error;
        }
        
        // Fetch company names for mapping
        const companyNames = await getCompanyNames();
        
        // Map jobs with company names attached via relationship
        const jobsWithCompanyNames = mapJobsWithCompanyNames(jobs || [], companyNames);
        
        console.log(`Found ${jobsWithCompanyNames.length} jobs with company names`);
        res.json(jobsWithCompanyNames);
    } catch (e: any) {
        console.error('Error in getJobsHandler:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

const deleteJobHandler: RequestHandler = async (req, res) => {
    try {
        const id = Number(req.params.id);
        console.log(`Deleting job ${id}...`);
        
        const { error } = await supabase.from('jobs').delete().eq('id', id);
        if (error) throw error;
        
        console.log(`Job ${id} deleted successfully`);
        res.json({ success: true });
    } catch (e: any) {
        console.error('Error in deleteJobHandler:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

const updateCompanyPriorityHandler: RequestHandler = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { priority } = req.body;
        
        console.log(`Updating company ${id} priority to ${priority}...`);
        
        await supabase.from('companies').update({ priority }).eq('id', id);
        await supabase.from('jobs').update({ priority }).eq('companyId', id);
        
        console.log(`Company ${id} priority updated successfully`);
        res.json({ success: true });
    } catch (e: any) {
        console.error('Error in updateCompanyPriorityHandler:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

/* ---------- Routes Registration ---------------------------------------- */
app.post('/api/companies', addCompanyHandler);
app.get('/api/companies', getCompaniesHandler);
app.delete('/api/companies/:id', deleteCompanyHandler);
app.put('/api/companies/:id/priority', updateCompanyPriorityHandler);
app.get('/api/jobs', getJobsHandler);
app.delete('/api/jobs/:id', deleteJobHandler);

/* ---------- Error handling middleware ---------------------------------- */
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

/* ---------- Scheduled tasks -------------------------------------------- */
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Running scheduled job check...');
  const { data: companies } = await supabase.from('companies').select<"*", Company>('*').eq('status', 'active');
  if (!companies || companies.length === 0) {
    console.log('[CRON] No active companies to check.');
    return;
  }
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    for (const company of companies) {
      let page;
      try {
        page = await browser.newPage();
        let foundJobs = await scrapeJobs(page, company.keywords, company.name, company.career_page_url);
        if (foundJobs.length === 0) {
          foundJobs = await scrapeWithoutAI(company);
        }

        const { data: existingJobs } = await supabase.from('jobs').select('url').eq('companyId', company.id);
        const existingUrls = new Set(existingJobs?.map(e => e.url));

        const newJobs = foundJobs.filter((f: ScrapedJob) => f.url && !existingUrls.has(f.url));
        if (newJobs.length === 0) {
          console.log(`[CRON] No new jobs found for ${company.name}.`);
        } else {
          const jobsToInsert = newJobs.map(job => {
            const { companyNameTmp, applicationDeadlineTmp, ...dbJob } = job;
            return { ...dbJob, companyId: company.id, priority: company.priority, status: 'New' };
          });
          if (jobsToInsert.length > 0) {
            await supabase.from('jobs').insert(jobsToInsert);
            console.log(`[CRON] SUCCESS: Added ${jobsToInsert.length} new jobs for ${company.name}`);
          }
        }
        
        await supabase.from('companies').update({ last_checked_at: new Date().toISOString() }).eq('id', company.id);
      } catch (err: any) {
        console.error(`[CRON] ERROR checking ${company.name}: ${err.message}`);
      } finally {
        if (page) {
          await page.close();
        }
      }
    }
  } catch (error) {
    console.error('[CRON] Error in scheduled task:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('[CRON] Finished scheduled job check.');
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export { app };

  export { scrapeJobs, scrapeWithoutAI, type ScrapedJob };

