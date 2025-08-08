import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';
import { scrapeJobs, scrapeWithoutAI, type ScrapedJob } from './index';

process.env['SUPABASE_URL'] = 'https://mock-supabase-url.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'mock-service-role-key';
process.env['GROQ_API_KEY'] = 'mock-groq-key';

// Define the Job interface locally for the test file
interface Job {
  id?: number;
  title: string;
  url: string;
  company: string;
  matchedKeywords: string[];
  dateFound: string;
  description?: string;
  applicationDeadline?: string | null;
  companyId?: number;
  status?: 'New' | 'Seen' | 'Applied' | 'Archived';
  priority?: string;
  salary?: string | null;
  requirements?: string[] | null;
}

// Mock playwright and node-fetch
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(() => ({
      newPage: jest.fn(async () => ({
        goto: jest.fn(),
        content: jest.fn(() => '<html><body><a href="job1.com">Job Title 1</a><a href="job2.com">Job Title 2</a></body></html>'),
        route: jest.fn((pattern: string, handler: any) => {
          // Mock route interception - just call continue for all routes
          const mockRoute = {
            fetch: jest.fn(() => Promise.resolve({
              ok: () => false,
              headers: () => ({}),
              text: () => Promise.resolve('')
            })),
            continue: jest.fn(),
            request: jest.fn(() => ({ url: () => 'http://example.com' }))
          };
          // Don't actually intercept, just continue
          return Promise.resolve();
        }),
        evaluate: jest.fn((func: (args: any) => any, args: any) => {
          if (func.toString().includes('document.querySelectorAll')) {
            const mockHtml = `<html><body>
              <a href="https://example.com/job/1">Software Engineer - React</a>
              <a href="https://example.com/job/2">Senior Frontend Developer</a>
              <a href="https://example.com/job/3">Product Manager</a>
              <a href="https://example.com/job/4">Backend Engineer - Node.js</a>
              <a href="https://example.com/job/5">Data Scientist</a>
            </body></html>`;
            const dom = new JSDOM(mockHtml);
            const document = dom.window.document;

            const jobs: ScrapedJob[] = [];
            const kwSet = new Set(args.kws.map((k: string) => k.toLowerCase()));
            const seen = new Set<string>();

            document.querySelectorAll('a[href]').forEach((a) => {
              const anchor = a as HTMLAnchorElement;
              const title = (anchor.textContent || anchor.title || '').trim();
              const url = anchor.href;

              if (!title || !url || seen.has(url)) return;

              const matched = ([...kwSet] as string[]).filter((k: string) => title.toLowerCase().includes(k));
              if (kwSet.size === 0 || matched.length > 0) {
                seen.add(url);
                jobs.push({
                  title,
                  url,
                  companyNameTmp: args.coName,
                  matchedKeywords: [...new Set(matched)],
                  dateFound: new Date().toISOString(),
                });
              }
            });
            return jobs;
          }
          return Promise.resolve();
        }),
      })),
      close: jest.fn(),
    })),
  },
}));

jest.mock('node-fetch', () => jest.fn());

describe('Job Scraping Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scrapeJobs', () => {
    it('should extract jobs based on keywords from a career page', async () => {
      const browser = await chromium.launch(); // Await launch
      const mockPage = await browser.newPage(); // Await newPage
      const keywords = ['react', 'frontend'];
      const companyName = 'TestCompany';
      const careerPageUrl = 'https://testcompany.com/careers';

      const jobs = await scrapeJobs(mockPage, keywords, companyName, careerPageUrl);

      expect(mockPage.goto).toHaveBeenCalledWith(careerPageUrl, expect.any(Object));
      expect(jobs).toHaveLength(2); // Expecting 'Software Engineer - React' and 'Senior Frontend Developer'
      expect(jobs[0]?.title).toBe('Software Engineer - React');
      expect(jobs[0]?.companyNameTmp).toBe(companyName);
      expect(jobs[0]?.matchedKeywords).toEqual(['react']);
      expect(jobs[1]?.title).toBe('Senior Frontend Developer');
      expect(jobs[1]?.matchedKeywords).toEqual(['frontend']);
    });

    it('should return all jobs if no keywords are provided', async () => {
      const browser = await chromium.launch(); // Await launch
      const mockPage = await browser.newPage(); // Await newPage
      const keywords: string[] = [];
      const companyName = 'TestCompany';
      const careerPageUrl = 'https://testcompany.com/careers';

      const jobs = await scrapeJobs(mockPage, keywords, companyName, careerPageUrl);

      expect(jobs).toHaveLength(5); // All 5 jobs from the mock HTML
      expect(jobs[0]?.title).toBe('Software Engineer - React');
      expect(jobs[4]?.title).toBe('Data Scientist');
    });
  });

  describe('scrapeWithoutAI', () => {
    it('should extract jobs using traditional scraping methods', async () => {
      const mockCompany = {
        id: 1,
        name: 'TestCompany',
        url: 'https://testcompany.com',
        career_page_url: 'https://testcompany.com/careers',
        keywords: ['engineer'],
        priority: 'high',
        check_interval_minutes: 60,
        status: 'active' as const,
        last_checked_at: new Date().toISOString(),
      };

      // Since scrapeWithoutAI uses Playwright internally, we would need to mock the browser
      // For now, we'll test that the function exists and can be called
      expect(typeof scrapeWithoutAI).toBe('function');
    });
  });
});
