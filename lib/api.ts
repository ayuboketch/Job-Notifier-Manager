// src/lib/api.ts
const api = {
  getCompanies: () => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/companies`).then(r => r.json()),
  deleteCompany: (id: number) => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/companies/${id}`, { method: 'DELETE' }),
};

export default api;

export const apiWithAuth = {
  getUser: () => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/user`, { 
    headers: { Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}` } 
  }).then(r => r.json()),
  
  getTrackedWebsites: () => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/tracked-websites`, { 
    headers: { Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}` } 
  }).then(r => r.json()),
  addTrackedWebsite: (data: { url: string; keywords: string; priority: string; checkInterval: string }) =>
    fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/tracked-websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}`,
      },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  deleteTrackedWebsite: (id: number) => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/tracked-websites/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}`,
    },
  }),
  getJobs: () => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/jobs`, {
    headers: {
      Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}`,
    },
  }).then(r => r.json()),
  saveJob: (jobId: number) => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/jobs/${jobId}/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 
      Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}`,
    },
  }).then(r => r.json()),
  unsaveJob: (jobId: number) => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/jobs/${jobId}/unsave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 
      Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}`,
    },
  }).then(r => r.json()),
  getSavedJobs: () => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/saved-jobs`, {
    headers: {
      Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}`,
    },
  }).then(r => r.json()),
  deleteSavedJob: (id: number) => fetch(`${process.env['EXPO_PUBLIC_API_BASE_URL']}/api/saved-jobs/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${process.env['EXPO_PUBLIC_TOKEN']}`,
    },
  }).then(r => r.json()),
};