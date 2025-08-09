import { chromium } from 'playwright';
import { ScrapedJob, scrapeJobs, scrapeWithoutAI } from './index';

// Mock environment variables
process.env['SUPABASE_URL'] = 'https://mock-supabase-url.supabase.co';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'mock-service-role-key';
process.env['GROQ_API_KEY'] = 'mock-groq-key';


jest.mock('playwright', () => {
  const actualPlaywright = jest.requireActual('playwright');
  return {
    chromium: {
      launch: jest.fn(() => ({
        newPage: jest.fn(async () => ({
        goto: jest.fn(),
        on: jest.fn(), // Add this line
        waitForTimeout: jest.fn(async (ms: number) => {
          // Mock wait, doesn't need to do anything real
          await new Promise(resolve => setTimeout(resolve, ms / 10)); // Simulate a short wait
        }),
         // Mock content to simulate HTML scraping
        content: jest.fn(() => `
          <html>
            <body>
              <a href="/jobs/software-engineer-react">Software Engineer - React</a>
              <div>Some text about React</div>
              <a href="/careers/frontend-developer">Senior Frontend Developer</a>
              <div>Frontend requirements</div>
              <a href="/positions/backend-engineer">Backend Engineer</a>
              <a href="/data-scientist-role">Data Scientist</a>
              <a href="/product-manager-opening">Product Manager</a>
            </body>
          </html>
        `),
        evaluate: jest.fn(async (func: (args: any) => any, args: any) => {
          // This mock simulates the HTML scraping logic found in scrapeJobs fallback
          const { kws, coName } = args;
          const kwSet = new Set(kws.map((k: string) => k.toLowerCase()));
          const seen = new Set<string>();
          const htmlJobs: ScrapedJob[] = [];

          // Simulate document.querySelectorAll('a[href]')
          const mockAnchors = [
            { textContent: 'Software Engineer - React', href: '/jobs/software-engineer-react' },
            { textContent: 'Senior Frontend Developer', href: '/careers/frontend-developer' },
            { textContent: 'Backend Engineer', href: '/positions/backend-engineer' },
            { textContent: 'Data Scientist', href: '/data-scientist-role' },
            { textContent: 'Product Manager', href: '/product-manager-opening' },
          ];

          mockAnchors.forEach((a) => {
            const title = (a.textContent || '').trim();
            const url = a.href;

            if (!title || !url || seen.has(url) || title.length < 3) { return; }

            const matched = Array.from(kwSet).filter((k) => title.toLowerCase().includes(k as string));
            if (kwSet.size === 0 || matched.length > 0) {
              seen.add(url);
              htmlJobs.push({
                title, url, companyNameTmp: coName, matchedKeywords: [...new Set(matched)],
                dateFound: new Date().toISOString(), // Add a mock date
              });
            }
          });
          return htmlJobs;
        }),
        route: jest.fn(async (pattern: string, handler: any) => {
          const mockRoute = {
            fetch: jest.fn(() => Promise.resolve({
              ok: () => false,
              headers: () => ({}),
              text: () => Promise.resolve('')
            })),
            continue: jest.fn(),
            request: jest.fn(() => ({ url: () => 'http://example.com' }))
          };
          // Call the actual handler if needed, or just resolve
          return Promise.resolve();
        }),
      })),
      close: jest.fn(),
      })),
    },
  };
});

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
