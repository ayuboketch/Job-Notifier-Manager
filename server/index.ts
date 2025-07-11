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
const findCareerPage = async (page: Page, url: string): Promise<string> => {
  const commonCareerPaths = ['/careers', '/jobs', '/employment', '/work-with-us', '/job-openings', '/opportunities'];
  
  try {
    console.log(`Finding career page for: ${url}`);
    
    // Try main URL first
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();
    
    if (/job|career|employment|hiring|opportunities/i.test(html)) {
      console.log(`Career content found on main page: ${url}`);
      return url;
    }
    
    // Try common career paths
    for (const path of commonCareerPaths) {
      try {
        const careerUrl = new URL(path, url).href;
        console.log(`Trying career URL: ${careerUrl}`);
        
        await page.goto(careerUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        
        // Check if page loaded successfully and contains career content
        const pageContent = await page.content();
        if (pageContent.length > 1000 && /job|career|employment|position|hiring/i.test(pageContent)) {
          console.log(`Found career page: ${careerUrl}`);
          return careerUrl;
        }
      } catch (e) {
        console.log(`Failed to load ${path}: ${e}`);
        continue;
      }
    }
    
    // Fallback to /careers
    const fallbackUrl = `${url}/careers`;
    console.log(`Using fallback URL: ${fallbackUrl}`);
    return fallbackUrl;
    
  } catch (err: any) {
    console.error(`Error finding career page for ${url}:`, err.message);
    throw new Error(`Could not find career page for ${url}: ${err.message}`);
  }
};

const scrapeJobs = async (page: Page, keywords: string[], companyName: string): Promise<Partial<Job>[]> => {
    console.log(`Scraping jobs for ${companyName} with keywords: ${keywords.join(', ')}`);
    
    return page.evaluate((kws: string[], coName: string) => {
        const jobs: Partial<Job>[] = [];
        const selectors = [
            'a[href*="job"]', 
            'a[href*="position"]', 
            'a[href*="career"]', 
            'a[href*="opening"]',
            '.job-listing', 
            '.position', 
            '.career-item', 
            '[class*="job"]',
            '[class*="position"]',
            '[class*="opening"]',
            '[data-testid*="job"]'
        ];
        
        const links = new Map<string, { text: string; keywords: string[] }>();
        
        selectors.forEach(sel => {
            try {
                document.querySelectorAll(sel).forEach(el => {
                    const anchor = el.closest('a') || el as HTMLAnchorElement;
                    if (!anchor || !anchor.href) return;
                    
                    const text = (anchor.textContent || anchor.innerText || '').trim().toLowerCase();
                    const href = anchor.href;
                    
                    // More flexible job detection
                    if (text.length > 0 && (
                        text.includes('job') || 
                        text.includes('career') || 
                        text.includes('position') || 
                        text.includes('opening') ||
                        text.includes('role') ||
                        href.includes('job') ||
                        href.includes('career') ||
                        href.includes('position')
                    )) {
                        const matchedKws = kws.filter(kw => text.includes(kw.toLowerCase()));
                        if (matchedKws.length > 0 || kws.length === 0) { // Include all jobs if no specific keywords
                            if (!links.has(href)) {
                                links.set(href, { text: (anchor.textContent || anchor.innerText || '').trim(), keywords: [] });
                            }
                            if (matchedKws.length > 0) {
                                links.get(href)!.keywords.push(...matchedKws);
                            }
                        }
                    }
                });
            } catch (e) {
                console.error(`Error with selector ${sel}:`, e);
            }
        });
        
        links.forEach((data, url) => {
            jobs.push({
                title: data.text || 'Job Opening',
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
        console.log(`Scraping job details from: ${jobUrl}`);
        await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        return await page.evaluate(() => {
            const descriptionSelectors = [
                '.job-description', 
                '.description', 
                '[class*="description"]', 
                '.content', 
                '.job-content', 
                'article', 
                'main',
                '.job-details',
                '[class*="job-details"]'
            ];
            
            let description = '';
            for (const sel of descriptionSelectors) {
                const el = document.querySelector(sel) as HTMLElement;
                if (el && el.innerText) {
                    description = el.innerText.trim();
                    if (description.length > 100) break;
                }
            }
            
            // If no description found, try to get any substantial text
            if (!description) {
                const bodyText = document.body.innerText || '';
                if (bodyText.length > 200) {
                    description = bodyText.substring(0, 500) + '...';
                }
            }
            
            // Look for application deadlines
            const patterns = [
                /deadline[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i, 
                /apply by[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
                /closing date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i
            ];
            
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
            
            return { 
                description: description || 'No description available.', 
                applicationDeadline: deadline 
            };
        });
    } catch (error: any) {
        console.error(`Error scraping job details from ${jobUrl}:`, error.message);
        return { description: 'Unable to fetch job description.', applicationDeadline: null };
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

          const newJobs = foundJobs.filter(f => f.url && !existingUrls.has(f.url));
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Network: http://192.168.100.88:${PORT}`);
});