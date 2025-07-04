// server/index.ts

import dotenv from 'dotenv';
import path from 'path';
// FINAL FIX: Use a more reliable path construction relative to the current file.
// This goes from `dist/index.js` up one level to `dist` and then up another to the project root.
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

app.use(cors());
app.use(express.json());

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

/* ---------- Scraping helpers (Refactored for efficiency) --------------- */
const findCareerPage = async (page: Page, url: string): Promise<string> => {
  const commonCareerPaths = ['/careers', '/jobs', '/employment', '/work-with-us', '/job-openings', '/opportunities'];
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    const html = await page.content();
    if (/job|career|employment/i.test(html)) {
      return url;
    }
    for (const path of commonCareerPaths) {
      try {
        const careerUrl = new URL(path, url).href;
        await page.goto(careerUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        if (page.url() === careerUrl && (await page.title())) {
          return careerUrl;
        }
      } catch { /* ignore */ }
    }
    return `${url}/careers`;
  } catch (err) {
    throw new Error(`Could not find career page for ${url}`);
  }
};

const scrapeJobs = async (page: Page, keywords: string[], companyName: string): Promise<Partial<Job>[]> => {
    return page.evaluate((kws: string[], coName: string) => {
        const jobs: Partial<Job>[] = [];
        const selectors = ['a[href*="job"]', 'a[href*="position"]', 'a[href*="career"]', '.job-listing', '.position', '.career-item', '[class*="job"]'];
        const links = new Map<string, { text: string; keywords: string[] }>();
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                const anchor = el as HTMLAnchorElement;
                if (!anchor.href) return;
                const text = (anchor.textContent || '').trim().toLowerCase();
                const href = anchor.href;
                if (text.includes('job') || text.includes('career') || text.includes('position')) {
                    const matchedKws = kws.filter(kw => text.includes(kw.toLowerCase()));
                    if (matchedKws.length > 0) {
                        if (!links.has(href)) {
                            links.set(href, { text: (anchor.textContent || '').trim(), keywords: [] });
                        }
                        links.get(href)!.keywords.push(...matchedKws);
                    }
                }
            });
        });
        links.forEach((data, url) => {
            jobs.push({
                title: data.text,
                url: url,
                company: coName,
                matchedKeywords: [...new Set(data.keywords)],
                dateFound: new Date().toISOString(),
            });
        });
        return jobs;
    }, keywords, companyName);
};

const scrapeJobDetails = async (page: Page, jobUrl: string): Promise<Pick<Job, 'description' | 'applicationDeadline'>> => {
    try {
        await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        return await page.evaluate(() => {
            const descriptionSelectors = ['.job-description', '.description', '[class*="description"]', '.content', '.job-content', 'article', 'main'];
            let description = '';
            for (const sel of descriptionSelectors) {
                const el = document.querySelector(sel) as HTMLElement;
                if (el && el.innerText) {
                    description = el.innerText.trim();
                    if (description.length > 200) break;
                }
            }
            const patterns = [/deadline[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i, /apply by[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i];
            const bodyText = (document.body.innerText || '');
            let deadline: string | null = null;
            for(const p of patterns){
                const match = bodyText.match(p);
                if(match && match[1]){
                    try {
                        deadline = new Date(match[1]).toISOString();
                        break;
                    } catch {}
                }
            }
            return { description: description || 'No description available.', applicationDeadline: deadline };
        });
    } catch {
        return { description: 'Unable to fetch job description.', applicationDeadline: null };
    }
};

/* ---------- Route Handlers --------------------------------------------- */
const addCompanyHandler: RequestHandler = async (req, res) => {
  const { url, keywords, priority, checkInterval } = req.body;
  if (!url || !keywords) {
    res.status(400).json({ success: false, error: "URL and keywords are required." });
    return;
  }

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const companyName = extractCompanyName(url);
    const careerPageUrl = await findCareerPage(page, url);
    const checkIntervalMinutes = convertIntervalToMinutes(checkInterval);
    const kwArray = keywords.split(',').map((k: string) => k.trim().toLowerCase());

    const { data: companyRow, error: companyErr } = await supabase.from('companies').insert({ name: companyName, url, careerPageUrl, keywords: kwArray, priority: priority || 'medium', checkInterval: checkIntervalMinutes, status: 'active', lastChecked: new Date().toISOString() }).select().single();
    if (companyErr) throw companyErr;

    await page.goto(careerPageUrl, { waitUntil: 'networkidle2' });
    const foundJobs = await scrapeJobs(page, kwArray, companyName);
    const jobsToInsert = [];
    for (const job of foundJobs) {
      if (!job.url) continue;
      const details = await scrapeJobDetails(page, job.url);
      jobsToInsert.push({ ...job, ...details, companyId: companyRow.id, status: 'New', priority: companyRow.priority });
    }
    if (jobsToInsert.length) {
      await supabase.from('jobs').insert(jobsToInsert);
    }
    
    res.json({ success: true, company: companyRow, jobsFound: jobsToInsert.length });
  } catch (e: any) {
    console.error("Error in addCompanyHandler:", e);
    res.status(500).json({ success: false, error: e.message });
  } finally {
      await browser.close();
  }
};

const getCompaniesHandler: RequestHandler = async (_req, res) => {
  try {
    const { data, error } = await supabase.from('companies').select('*');
    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
};

const deleteCompanyHandler: RequestHandler = async (req, res) => {
    try {
        const id = Number(req.params.id);
        await supabase.from('jobs').delete().eq('companyId', id);
        const { error } = await supabase.from('companies').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

const getJobsHandler: RequestHandler = async (_req, res) => {
    try {
        const { data, error } = await supabase.from('jobs').select('*');
        if (error) throw error;
        res.json(data || []);
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

const deleteJobHandler: RequestHandler = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { error } = await supabase.from('jobs').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
};

const updateCompanyPriorityHandler: RequestHandler = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { priority } = req.body;
        await supabase.from('companies').update({ priority }).eq('id', id);
        await supabase.from('jobs').update({ priority }).eq('companyId', id);
        res.json({ success: true });
    } catch (e: any) {
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

/* ---------- Scheduled tasks -------------------------------------------- */
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Running scheduled job check...');
  const { data: companies } = await supabase.from('companies').select<"*", Company>('*').eq('status', 'active');
  if (!companies || companies.length === 0) {
    console.log('[CRON] No active companies to check.');
    return;
  }
  
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
      const page = await browser.newPage();
      for (const company of companies) {
        try {
          console.log(`[CRON] Checking company: ${company.name}`);
          await page.goto(company.careerPageUrl, { waitUntil: 'networkidle2' });
          const foundJobs = await scrapeJobs(page, company.keywords, company.name);

          const { data: existingJobs } = await supabase.from('jobs').select('url').eq('companyId', company.id);
          const existingUrls = new Set(existingJobs?.map(e => e.url));

          const newJobs = foundJobs.filter(f => f.url && !existingUrls.has(f.url));
          if (newJobs.length === 0) {
              console.log(`[CRON] No new jobs found for ${company.name}.`);
              await supabase.from('companies').update({ lastChecked: new Date().toISOString() }).eq('id', company.id);
              continue;
          }

          const jobsToInsert = [];
          for (const job of newJobs) {
              if (!job.url) continue;
              const details = await scrapeJobDetails(page, job.url);
              jobsToInsert.push({ ...job, ...details, companyId: company.id, status: 'New', priority: company.priority });
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
  } finally {
      await browser.close();
      console.log('[CRON] Finished scheduled job check.');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
});