// api/cron/check-jobs.ts
import { cleanJobsWithAI, scrapeJobs, scrapeWithoutAI } from '@/server';
import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
// import { chromium } from 'playwright';
import { chromium } from 'playwright-core';

// Initialize Supabase
const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const supabase = createClient(supabaseUrl, supabaseKey);

// You'll need to extract these functions to a separate utility file
// since you can't import from server/index.ts in Vercel functions

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify this is a cron request
  if (req.headers.authorization !== `Bearer ${process.env['CRON_SECRET']}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[CRON] Starting scheduled job check...');
  
  try {
    // Get all active companies for all users
    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')
      .eq('status', 'active');
      
    if (error) {
      console.error('[CRON] Database error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!companies || companies.length === 0) {
      console.log('[CRON] No active companies found.');
      return res.json({ message: 'No companies to check', processed: 0 });
    }

    const now = new Date();
    const companiesDueForCheck = companies.filter(company => {
      if (!company.last_checked_at) return true;

      const lastChecked = new Date(company.last_checked_at);
      const intervalMinutes = company.check_interval_minutes || 1440;
      const nextCheckTime = new Date(lastChecked.getTime() + (intervalMinutes * 60 * 1000));
      
      return now >= nextCheckTime;
    });

    if (companiesDueForCheck.length === 0) {
      console.log('[CRON] No companies due for checking right now.');
      return res.json({ message: 'No companies due', processed: 0 });
    }

    console.log(`[CRON] Processing ${companiesDueForCheck.length} companies`);

    // Process up to 5 companies per cron run to avoid timeout
    const maxCompaniesPerRun = 5;
    const companiesToCheck = companiesDueForCheck.slice(0, maxCompaniesPerRun);
    
    let totalNewJobs = 0;
    let browser;

    try {
      browser = await chromium.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });

      for (const company of companiesToCheck) {
        let page;
        try {
          console.log(`[CRON] Processing ${company.name}...`);
          page = await browser.newPage();
          
          let foundJobs = await scrapeJobs(page, company.keywords, company.name, company.career_page_url);
          if (foundJobs.length === 0) {
            foundJobs = await scrapeWithoutAI(company);
          }
          foundJobs = await cleanJobsWithAI(foundJobs);

          // Check existing jobs for THIS USER only
          const { data: existingJobs } = await supabase
            .from('jobs')
            .select('url')
            .eq('companyId', company.id)
            .eq('user_id', company.user_id);
            
          const existingUrls = new Set(existingJobs?.map(e => e.url) || []);
          const newJobs = foundJobs.filter(f => f.url && !existingUrls.has(f.url));
          
          if (newJobs.length > 0) {
            const jobsToInsert = newJobs.map(job => {
              const { companyNameTmp, applicationDeadlineTmp, duties, ...dbJob } = job;
              return { 
                ...dbJob, 
                companyId: company.id, 
                priority: company.priority, 
                status: 'New',
                user_id: company.user_id
              };
            });
            
            const { error: insertError } = await supabase.from('jobs').insert(jobsToInsert);
            if (insertError) {
              console.error(`[CRON] Failed to insert jobs for ${company.name}:`, insertError);
            } else {
              console.log(`[CRON] Added ${newJobs.length} new jobs for ${company.name}`);
              totalNewJobs += newJobs.length;
            }
          } else {
            console.log(`[CRON] No new jobs for ${company.name}`);
          }
          
          // Update last checked time
          await supabase
            .from('companies')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', company.id);
            
        } catch (err: any) {
          console.error(`[CRON] Error processing ${company.name}:`, err.message);
        } finally {
          if (page && !page.isClosed()) {
            await page.close();
          }
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    console.log(`[CRON] Completed. Processed ${companiesToCheck.length} companies, found ${totalNewJobs} new jobs`);
    
    res.json({ 
      success: true, 
      processed: companiesToCheck.length,
      newJobs: totalNewJobs,
      totalCompanies: companies.length,
      due: companiesDueForCheck.length
    });

  } catch (error: any) {
    console.error('[CRON] Main cron error:', error);
    res.status(500).json({ error: error.message });
  }
}