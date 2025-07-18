// server/index.ts

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// The rest of your imports
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import express, { Request, RequestHandler } from 'express';
import cron from 'node-cron';
import puppeteer, { Page } from 'puppeteer';

interface AuthRequest extends Request {
    user?: any;
}

/* ---------- Supabase ---------------------------------------------------- */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Service Role Key is missing from .env. Check server configuration.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

/* ---------- Domain types ------------------------------------------------ */
interface Company {
  id: number;
  name: string;
  url: string;
  careerPageUrl: string;
  keywords: string[];
  priority: string;
  checkInterval: number; // Stored as minutes
  status: 'active' | 'inactive';
  lastChecked: string;
}

interface Job {
  id: number;
  title: string;
  url: string;
  company: string;
  matchedKeywords: string[];
  dateFound: string;
  description: string;
  applicationDeadline: string | null;
  companyId: number;
  status: 'New' | 'Seen' | 'Applied' | 'Archived';
  priority: string;
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
const findCareerPage = async (page: Page, homeUrl: string): Promise<string> => {
  const clean = homeUrl.replace(/\/+$/, ""); // remove trailing slashes

  // 1) Try /jobs (LinkedIn, Stripe, etc.)
  const jobs = `${clean}/jobs`;
  try {
    await page.goto(jobs, { waitUntil: "domcontentloaded", timeout: 8000 });
    if ((await page.content()).length > 2000) return jobs;
  } catch {/* ignore */}

  // 2) Try /careers
  const careers = `${clean}/careers`;
  try {
    await page.goto(careers, { waitUntil: "domcontentloaded", timeout: 8000 });
    if ((await page.content()).length > 2000) return careers;
  } catch {/* ignore */}

  // 3) Fallback: home page already lists jobs
  try {
    await page.goto(clean, { waitUntil: "domcontentloaded", timeout: 8000 });
    return clean;
  } catch {/* ignore */}

  throw new Error(`Could not locate a jobs or careers page for ${homeUrl}`);
};

const scrapeJobs = async (
  page: Page,
  keywords: string[],
  companyName: string
): Promise<Partial<Job>[]> => {
  await page.waitForTimeout(1000); // allow SPA hydration

  return page.evaluate((kws, coName) => {
    const list: Partial<Job>[] = [];
    const kSet = new Set(kws.map((k) => k.toLowerCase()));

    // LinkedIn, Indeed, generic
    const cards = document.querySelectorAll(
      "[data-automation-id='job-card'], .jobs-search-results__list-item, .job-card, a[href*='jobs/view']"
    );

    cards.forEach((c) => {
      const link = c.closest("a") as HTMLAnchorElement;
      const title = c.textContent?.trim();
      if (!link || !title) return;

      const matched = [...kSet].filter((k) => title.toLowerCase().includes(k));
      if (kSet.size === 0 || matched.length) {
        list.push({
          title,
          url: link.href,
          company: coName,
          matchedKeywords: [...new Set(matched)],
          dateFound: new Date().toISOString(),
        });
      }
    });

    return list;
  }, keywords, companyName);
};

const scrapeJobDetails = async (
  page: Page,
  jobUrl: string
): Promise<Pick<Job, "description" | "applicationDeadline">> => {
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    return await page.evaluate(() => {
      // Description
      const descEl =
        document.querySelector("article") ??
        document.querySelector(".jobs-description-content") ??
        document.body;
      const description =
        descEl?.textContent?.trim().slice(0, 1200) ?? "No description";

      // Deadline (LinkedIn & common patterns)
      const patterns = [
        /(?:deadline|apply by|closing date)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /(?:deadline|apply by|closing date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
      ];
      let deadline: string | null = null;
      for (const p of patterns) {
        const m = document.body.textContent?.match(p);
        if (m) {
          try {
            deadline = new Date(m[1]).toISOString();
            break;
          } catch {/* ignore */}
        }
      }

      return { description, applicationDeadline: deadline };
    });
  } catch {
    return {
      description: "Unable to fetch job details",
      applicationDeadline: null,
    };
  }
};

/* ---------- Route Handlers (Enhanced with better error handling) ------- */
const addCompanyHandler: RequestHandler = async (req, res) => {
  console.log('Add company request received:', req.body);
  
  const { url, keywords, priority, checkInterval } = req.body;
  
  if (!url || !keywords) {
    console.log('Missing required fields');
    res.status(400).json({ success: false, error: "URL and keywords are required." });
    return;
  }

  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({ 
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const companyName = extractCompanyName(url);
    console.log(`Processing company: ${companyName}`);
    
    const careerPageUrl = await findCareerPage(page, url);
    const checkIntervalMinutes = convertIntervalToMinutes(checkInterval);
    const kwArray = keywords.split(',').map((k: string) => k.trim().toLowerCase());

    console.log('Inserting company into database...');
    const { data: companyRow, error: companyErr } = await supabase
      .from('companies')
      .insert({ 
        name: companyName, 
        url, 
        careerPageUrl, 
        keywords: kwArray, 
        priority: priority || 'medium', 
        checkInterval: checkIntervalMinutes, 
        status: 'active', 
        lastChecked: new Date().toISOString() 
      })
      .select()
      .single();
      
    if (companyErr) {
      console.error('Database error:', companyErr);
      throw new Error(`Database error: ${companyErr.message}`);
    }

    console.log('Company inserted successfully:', companyRow);
    
    // Scrape initial jobs
    console.log('Scraping initial jobs...');
    await page.goto(careerPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    const foundJobs = await scrapeJobs(page, kwArray, companyName);
    
    console.log(`Found ${foundJobs.length} jobs`);
    
    const jobsToInsert = [];
    for (const job of foundJobs.slice(0, 10)) { // Limit to first 10 jobs to avoid timeout
      if (!job.url) continue;
      
      try {
        const details = await scrapeJobDetails(page, job.url);
        jobsToInsert.push({ 
          ...job, 
          ...details, 
          companyId: companyRow.id, 
          status: 'New', 
          priority: companyRow.priority 
        });
      } catch (error) {
        console.error(`Error scraping job details for ${job.url}:`, error);
        // Insert job without detailed description
        jobsToInsert.push({ 
          ...job, 
          description: 'Description not available',
          applicationDeadline: null,
          companyId: companyRow.id, 
          status: 'New', 
          priority: companyRow.priority 
        });
      }
    }
    
    if (jobsToInsert.length > 0) {
      console.log(`Inserting ${jobsToInsert.length} jobs...`);
      const { error: jobsError } = await supabase.from('jobs').insert(jobsToInsert);
      if (jobsError) {
        console.error('Error inserting jobs:', jobsError);
        // Don't fail the entire operation if job insertion fails
      }
    }
    
    console.log('Company added successfully');
    res.json({ success: true, company: companyRow, jobsFound: jobsToInsert.length });
    
  } catch (e: any) {
    console.error("Error in addCompanyHandler:", e);
    res.status(500).json({ success: false, error: e.message || 'Internal server error' });
  } finally {
    if (browser) {
      await browser.close();
    }
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
        console.log('Fetching jobs...');
        const { data, error } = await supabase.from('jobs').select('*');
        if (error) {
            console.error('Database error:', error);
            throw error;
        }
        console.log(`Found ${data?.length || 0} jobs`);
        res.json(data || []);
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
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      
      for (const company of companies) {
        try {
          console.log(`[CRON] Checking company: ${company.name}`);
          await page.goto(company.careerPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          const foundJobs = await scrapeJobs(page, company.keywords, company.name);

          const { data: existingJobs } = await supabase.from('jobs').select('url').eq('companyId', company.id);
          const existingUrls = new Set(existingJobs?.map(e => e.url));

          const newJobs = foundJobs.filter((f: Partial<Job>) => f.url && !existingUrls.has(f.url));
          if (newJobs.length === 0) {
              console.log(`[CRON] No new jobs found for ${company.name}.`);
              await supabase.from('companies').update({ lastChecked: new Date().toISOString() }).eq('id', company.id);
              continue;
          }

          const jobsToInsert = [];
          for (const job of newJobs.slice(0, 5)) { // Limit to 5 new jobs per company
              if (!job.url) continue;
              
              try {
                const details = await scrapeJobDetails(page, job.url);
                jobsToInsert.push({ ...job, ...details, companyId: company.id, status: 'New', priority: company.priority });
              } catch (error) {
                console.error(`[CRON] Error scraping job details:`, error);
                jobsToInsert.push({ 
                  ...job, 
                  description: 'Description not available',
                  applicationDeadline: null,
                  companyId: company.id, 
                  status: 'New', 
                  priority: company.priority 
                });
              }
          }

          if (jobsToInsert.length > 0) {
              await supabase.from('jobs').insert(jobsToInsert);
              console.log(`[CRON] SUCCESS: Added ${jobsToInsert.length} new jobs for ${company.name}`);
          }
          
          await supabase.from('companies').update({ lastChecked: new Date().toISOString() }).eq('id', company.id);
        } catch (err: any) {
          console.error(`[CRON] ERROR checking ${company.name}: ${err.message}`);
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

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`✅ Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Network: http://192.168.100.88:${PORT}`);
});