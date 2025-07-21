// server/index.ts

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// The rest of your imports
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import express, { Request, RequestHandler } from 'express';
import cron from 'node-cron';
import fetch from 'node-fetch';
import { chromium } from 'playwright';
// import puppeteer from 'puppeteer';

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
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'mixtral-8x7b-32768';

/* ---------- Domain types ------------------------------------------------ */
interface Company {
  id: number;
  name: string;
  url: string;
  career_page_url: string;
  keywords: string[];
  priority: string;
  checkInterval: number; // Stored as minutes
  status: 'active' | 'inactive';
  last_checked: string;
  careerPageUrl?: string; // optional override
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
async function findCareerPage(site: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  const paths   = ['jobs', 'careers', 'opportunities', 'work-with-us', 'open-positions'];

  for (const p of paths) {
    const url = new URL(p, site).href;
    try {
      await page.goto(url, { waitUntil: 'networkidle',  timeout: 8000 });
      const hasJobs = await page.locator('a[href*="job"], [data-job-id]').first().isVisible();
      if (hasJobs) {
        await browser.close();
        return url;
      }
    } catch {
      /* ignore */
    }
  }

  await browser.close();
  return site; // fallback
}

function parseJobsFromGpt(gptText: string, company: any): any[] {
  if (!gptText) return [];

  const jobLines = gptText.split('\n').filter(line => line.trim().length > 0);
  const jobs = jobLines.map((line, i) => ({
    companyId: company.id,
    company: company.name,
    title: line.slice(0, 150),
    description: line,
    url: company.careerPageUrl || company.url,
    matchedKeywords: company.keywords,
    priority: company.priority,
    status: 'New',
    dateFound: new Date().toISOString(),
    applicationDeadline: null,
  }));

  return jobs;
}

async function scrapeJobs(
  page: import('playwright').Page,
  keywords: string[],
  companyName: string,
  career_page_url: string
): Promise<Partial<Job>[]> {
  // 1️⃣  wait until the page is fully interactive
  await page.goto(career_page_url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // 2️⃣  scroll the viewport to the bottom until no more jobs appear
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    let prevCount = 0;
    let attempts = 0;
    while (attempts < 8) {
      const currentCount = document.querySelectorAll('a').length;
      if (currentCount === prevCount) {
        attempts++;
        await delay(400);
      } else {
        attempts = 0;
        prevCount = currentCount;
      }
      window.scrollTo(0, document.body.scrollHeight);
      await delay(400);
    }
  });

  // 3️⃣  universal extraction
  return page.evaluate(({ kws, coName }) => {
    const kwSet = new Set(kws.map((k) => k.toLowerCase()));
    const seen = new Set<string>();
    const jobs: Partial<Job>[] = [];

    // any <a> that contains common job tokens or has 'href' pointing to a job
    const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href]');
    anchors.forEach((a) => {
      const title = (a.textContent || a.title || '').trim();
      const url = a.href;
      if (!title || !url || seen.has(url)) return;
      seen.add(url);

      // heuristic: title must contain at least one keyword OR no keywords were provided
      const matched = [...kwSet].filter(k => title.toLowerCase().includes(k));
      if (kwSet.size === 0 || matched.length) {
        jobs.push({
          title,
          url,
          company: coName,
          matchedKeywords: [...new Set(matched)],
          dateFound: new Date().toISOString(),
        });
      }
    });

    // extra safety: any block that contains a <a> and looks like a job card
    const cards = document.querySelectorAll('[role="row"], [class*="job"], [class*="position"], [data-testid*="job"], [data-testid*="position"]');
    cards.forEach((card) => {
      const a = card.querySelector<HTMLAnchorElement>('a[href]');
      const title = (card.textContent || '').trim();
      const url = a?.href;
      if (!title || !url || seen.has(url)) return;
      seen.add(url);

      const matched = [...kwSet].filter(k => title.toLowerCase().includes(k));
      if (kwSet.size === 0 || matched.length) {
        jobs.push({
          title,
          url,
          company: coName,
          matchedKeywords: [...new Set(matched)],
          dateFound: new Date().toISOString(),
        });
      }
    });
    

    return jobs;
  }, { kws: keywords, coName: companyName });
}

async function scrapeJobDetails(
  page: import('playwright').Page,
  jobUrl: string
): Promise<Pick<Job, 'description' | 'applicationDeadline'>> {
  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    return page.evaluate(() => {
      const descEl =
        document.querySelector('article') ??
        document.querySelector('.jobs-description-content') ??
        document.body;

      const description = descEl?.textContent?.trim().slice(0, 1200) ?? 'No description';

      const patterns = [
        /(?:deadline|apply by|closing date)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /(?:deadline|apply by|closing date)[:\s]+(\d{4}-\d{2}-\d{2})/i,
      ];

      let deadline: string | null = null;
      for (const p of patterns) {
        const m = document.body.textContent?.match(p);
        if (m) {
          try { deadline = new Date(m[1]).toISOString(); break; } catch {/* ignore */}
        }
      }

      return { description, applicationDeadline: deadline };
    });
  } catch {
    return { description: 'Unable to fetch details', applicationDeadline: null };
  }
}

/* ---------- Route Handlers (Enhanced with better error handling) ------- */
export const addCompanyHandler: RequestHandler = async (req, res) => {
  const { url, careerPageUrl, keywords, priority, checkInterval } = req.body;

  const name = extractCompanyName(url);
  const createdAt = new Date().toISOString();

  const { data: company, error } = await supabase
    .from('companies')
    .insert([{ name, url, careerPageUrl, keywords, priority, checkInterval, createdAt }])
    .select()
    .single();

  if (error || !company) {
    res.status(500).json({ error: 'Failed to add company', detail: error?.message });
    return;
  }

  // 🔥 GPT Fallback
  try {
    const gptRes = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a smart job parser. Given raw job listings or messy HTML, extract job title, description, URL, and any deadline.',
          },
          {
            role: 'user',
            content: `Scrape jobs from: ${careerPageUrl || url}.\nFocus on keywords: ${keywords}.`,
          },
        ],
      }),
    });

    const gptData = await gptRes.json() as { choices?: { message?: { content?: string } }[] };
    const gptText = gptData?.choices?.[0]?.message?.content || '';

    interface GptJob {
      companyId: number;
      company: string;
      title: string;
      description: string;
      url: string;
      matchedKeywords: string[];
      priority: string;
      status: 'New' | 'Seen' | 'Applied' | 'Archived';
      dateFound: string;
      applicationDeadline: string | null;
    }

    const jobs: GptJob[] = gptText
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string): GptJob => ({
        companyId: company.id,
        company: company.name,
        title: line.slice(0, 150),
        description: line,
        url: careerPageUrl || url,
        matchedKeywords: keywords,
        priority,
        status: 'New',
        dateFound: new Date().toISOString(),
        applicationDeadline: null,
      }));

    if (jobs.length > 0) {
      const { error: jobError } = await supabase.from('jobs').insert(jobs);
      if (jobError) console.error('Job insert error:', jobError.message);
    }

    res.json({ success: true, company, jobsFound: jobs.length, jobs });
    return;
  } catch (err) {
    console.error('Groq API error:', err);
    res.json({
      success: true,
      company,
      jobsFound: 0,
      jobs: [],
      warning: 'Company added, but GPT job extraction failed.',
    });
    return;
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
app.post('/api/extract-with-gpt', async (req, res) => {
  const { html, companyName, keywords } = req.body;

  const prompt = `
You are a job listing extractor. Given the following raw HTML from a company career page, extract all job titles and URLs related to the keywords: [${keywords.join(', ')}].

Only return jobs as JSON:
[{ "title": "Frontend Engineer", "url": "https://..." }, ...]
`;

  try {
    const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'user', content: prompt + '\n\n' + html },
        ],
        temperature: 0,
      }),
    });

    const data = await response.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      'choices' in data &&
      Array.isArray((data as any).choices) &&
      (data as any).choices[0]?.message?.content
    ) {
      const parsed = JSON.parse((data as any).choices[0].message.content);
      res.json({ jobs: parsed });
    } else {
      res.status(500).json({ error: 'Unexpected response format from Groq API' });
    }
  } catch (err) {
    console.error('Error using Groq API:', err);
    res.status(500).json({ error: 'Failed to extract jobs using Groq' });
  }
});

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
      const page = await browser.newPage();
      
      for (const company of companies) {
        try {
          await page.goto(company.career_page_url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          const foundJobs = await scrapeJobs(page, company.keywords, company.name, company.career_page_url);
          // const foundJobs = await scrapeJobs(page, company.keywords, company.name);

          const { data: existingJobs } = await supabase.from('jobs').select('url').eq('companyId', company.id);
          const existingUrls = new Set(existingJobs?.map(e => e.url));

          const newJobs = foundJobs.filter((f: Partial<Job>) => f.url && !existingUrls.has(f.url));
          if (newJobs.length === 0) {
              console.log(`[CRON] No new jobs found for ${company.name}.`);
              await supabase.from('companies').update({ last_checked: new Date().toISOString() }).eq('id', company.id);
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
          
          await supabase.from('companies').update({ last_checked: new Date().toISOString() }).eq('id', company.id);
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