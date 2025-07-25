// app/(app)/dashboard.tsx - FINAL STABLE VERSION
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AddCompanyModal from "../../components/AddCompanyModal";
import CompanyListModal from "../../components/CompanyListModal";
import JobListModal from "../../components/JobListModal";
import { useAuth } from "../../context/AuthContext";

// Unified interfaces
interface TrackedWebsite {
  id: number;
  name: string;
  url: string;
  career_page_url: string;
  keywords: string[];
  priority: string;
  check_interval_minutes: number;
  status: "active" | "inactive";
  last_checked_at: string;
}

interface JobAlert {
  id: number;
  title: string;
  url: string;
  company: string | { id: number; name: string }; // Support both legacy string and new nested format
  companyName?: string; // New derived field from server
  matchedKeywords: string[];
  dateFound: string;
  description?: string;
  applicationDeadline?: string | null;
  companyId?: number;
  status?: "New" | "Seen" | "Applied" | "Archived";
  priority?: string;
  salary?: string | null;
  requirements?: string[] | null;
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.100.36:3000/api";

// Enhanced fetch function with proper error handling
async function apiRequest(url: string, options: RequestInit = {}) {
  try {
    console.log(`Making API request to: ${url}`);
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} - ${errorText}`);
      throw new Error(
        `HTTP ${response.status}: ${errorText || "Request failed"}`
      );
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Request failed:", error);
    if (
      error instanceof TypeError &&
      error.message.includes("Network request failed")
    ) {
      throw new Error(
        "Network connection failed. Please check your internet connection and ensure the server is running."
      );
    }
    throw error;
  }
}

export default function DashboardScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [trackedCompanies, setTrackedCompanies] = useState<TrackedWebsite[]>(
    []
  );
  const [jobs, setJobs] = useState<JobAlert[]>([]);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobAlert | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCompaniesModal, setShowCompaniesModal] = useState(false);
  const [showAllJobsModal, setShowAllJobsModal] = useState(false);
  const [showPriorityJobsModal, setShowPriorityJobsModal] = useState(false);
  const [showWatchlistJobsModal, setShowWatchlistJobsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingCompany, setAddingCompany] = useState(false);

  // Use a ref to hold the interval ID
  const refreshIntervalRef = useRef<number | null>(null);

  // Memoized lists
  const priorityJobs = React.useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.priority === "high" ||
          (job.matchedKeywords && job.matchedKeywords.length > 0)
      ),
    [jobs]
  );
  const watchlistJobs = React.useMemo(() => {
    const highPriorityCompanyIds = new Set(
      trackedCompanies.filter((c) => c.priority === "high").map((c) => c.id)
    );
    return jobs.filter(
      (job) => job.companyId && highPriorityCompanyIds.has(job.companyId)
    );
  }, [jobs, trackedCompanies]);
  const recentActivityJobs = React.useMemo(
    () =>
      jobs
        .slice()
        .sort(
          (a, b) =>
            new Date(b.dateFound).getTime() - new Date(a.dateFound).getTime()
        )
        .slice(0, 20),
    [jobs]
  );

  // Helper function to get company display name from various formats
  const getCompanyDisplayName = (job: any): string => {
    // Priority order: companyName (new derived field) > nested company.name > legacy company string
    if (job.companyName) {
      return job.companyName;
    }
    if (job.company && typeof job.company === 'object' && job.company.name) {
      return job.company.name;
    }
    if (job.company && typeof job.company === 'string') {
      return job.company;
    }
    return job.company_name || "Unknown Company";
  };

  // Stable data mapping function
  const mapJobData = useCallback(
    (job: any): JobAlert => ({
      id: job.id,
      title: job.title || job.job_title || "Unknown Title",
      url: job.url || job.job_url || "",
      company: job.company || job.company_name || "Unknown Company", // Keep for backward compatibility
      companyName: job.companyName, // New derived field from server
      matchedKeywords: job.matchedKeywords || job.matched_keywords || [],
      dateFound:
        job.dateFound ||
        job.date_found ||
        job.created_at ||
        new Date().toISOString(),
      description: job.description || job.job_description,
      applicationDeadline: job.applicationDeadline || job.application_deadline,
      companyId: job.companyId || job.company_id,
      status: job.status || "New",
      priority: job.priority,
      salary: job.salary || job.salary_range,
      requirements: job.requirements,
    }),
    []
  );

  // Stable data fetching function with smart merging
  const fetchData = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      }
      setError(null);
      try {
        console.log("Fetching data from server...");
        const [companiesData, jobsData] = await Promise.all([
          apiRequest(`${API_BASE_URL}/companies`),
          apiRequest(`${API_BASE_URL}/jobs`),
        ]);
        const fetchedCompanies = companiesData || [];
        const fetchedJobs = jobsData || [];
        
        // Smart merging: only replace if we actually got data
        if (fetchedCompanies.length > 0 || isInitial) {
          setTrackedCompanies(fetchedCompanies);
        }
        
        if (fetchedJobs.length > 0 || isInitial) {
          const mappedJobs = fetchedJobs.map(mapJobData);
          setJobs(prevJobs => {
            // If this is a refresh and we have no new jobs, keep existing ones
            if (!isInitial && mappedJobs.length === 0 && prevJobs.length > 0) {
              console.log("⚠️ No jobs from server, keeping existing jobs");
              return prevJobs;
            }
            return mappedJobs;
          });
        }
        
        console.log(
          `✅ Loaded ${fetchedCompanies.length} companies and ${fetchedJobs.length} jobs`
        );
      } catch (e) {
        const error = e as Error;
        console.error("Failed to fetch data:", error);
        if (!isInitial) {
          // Don't show error for background refreshes, just log it
          console.log("Background refresh failed, keeping existing data");
        } else {
          setError(error.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [mapJobData]
  );

  // Effect for managing the refresh interval
  useEffect(() => {
    const startInterval = () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      refreshIntervalRef.current = setInterval(() => {
        console.log("[Interval] Auto-refreshing data...");
        fetchData();
      }, 30000);
    };

    fetchData(true); // Initial fetch
    startInterval(); // Start the interval

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchData]);

  const handleAddCompany = async (companyData: {
    url: string;
    careerPageUrl?: string;
    keywords: string;
    priority: string;
    checkInterval: string;
  }) => {
    // 1. Stop the auto-refresh timer to prevent a race condition
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    try {
      setAddingCompany(true);
      console.log("Adding company:", companyData);
      const result = await apiRequest(`${API_BASE_URL}/companies`, {
        method: "POST",
        body: JSON.stringify(companyData),
      });

      if (result.success) {
        // 2. Perform the optimistic update with deduplication
        const newCompany = result.company;
        const newJobs = (result.jobs || []).map(mapJobData);

        if (newCompany) {
          setTrackedCompanies((prev) => {
            // Check if company already exists
            const exists = prev.find(c => c.id === newCompany.id);
            if (exists) {
              return prev; // Don't add duplicate
            }
            return [...prev, newCompany];
          });
        }
        
        if (newJobs.length > 0) {
          setJobs((prev) => {
            // Merge new jobs with existing ones, avoiding duplicates
            const existingUrls = new Set(prev.map(job => job.url));
            const uniqueNewJobs = newJobs.filter(job => !existingUrls.has(job.url));
            console.log(`Adding ${uniqueNewJobs.length} new unique jobs out of ${newJobs.length} found`);
            return [...prev, ...uniqueNewJobs];
          });
        }

        setShowAddCompanyModal(false);
        Alert.alert(
          "Success!",
          `Added ${newCompany?.name || "Company"}. Found ${
            newJobs.length
          } jobs.`
        );
      } else {
        throw new Error(result.error || "Failed to add company");
      }
    } catch (e) {
      const error = e as Error;
      console.error("Failed to add company:", error);
      Alert.alert("Error", error.message);
    } finally {
      setAddingCompany(false);
      // 3. Restart the auto-refresh timer
      const startInterval = () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
        refreshIntervalRef.current = setInterval(() => {
          console.log("[Interval] Auto-refreshing data...");
          fetchData();
        }, 30000);
      };
      startInterval();
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const handleJobPress = (job: JobAlert) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const handleDeleteJob = async (jobId: number) => {
    try {
      await apiRequest(`${API_BASE_URL}/jobs/${jobId}`, { method: "DELETE" });
      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      setShowJobModal(false);
      Alert.alert("Success", "Job removed successfully");
    } catch (e) {
      Alert.alert("Error", "Failed to delete job");
    }
  };

  const handleDeleteCompany = async (companyId: number) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this company and all its associated jobs?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`${API_BASE_URL}/companies/${companyId}`, {
                method: "DELETE",
              });
              setTrackedCompanies((prev) =>
                prev.filter((company) => company.id !== companyId)
              );
              setJobs((prev) =>
                prev.filter((job) => job.companyId !== companyId)
              );
              Alert.alert("Success", "Company deleted successfully.");
            } catch (e) {
              const error = e as Error;
              Alert.alert("Error", `Failed to delete company: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchData(true)}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Job Tracker</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.mainScrollView}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={() => fetchData(true)}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => setShowCompaniesModal(true)}
            >
              <Text style={styles.statNumber}>{trackedCompanies.length}</Text>
              <Text style={styles.statLabel}>Companies</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => setShowAllJobsModal(true)}
            >
              <Text style={styles.statNumber}>{jobs.length}</Text>
              <Text style={styles.statLabel}>Jobs Found</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddCompanyModal(true)}
          >
            <Text style={styles.addButtonText}>+ Add Company</Text>
          </TouchableOpacity>

          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => setShowPriorityJobsModal(true)}
            >
              <Text style={styles.statNumber}>{priorityJobs.length}</Text>
              <Text style={styles.statLabel}>Priority</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => setShowWatchlistJobsModal(true)}
            >
              <Text style={styles.statNumber}>{watchlistJobs.length}</Text>
              <Text style={styles.statLabel}>Watchlist</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentActivityJobs.length === 0 ? (
              <Text style={styles.emptyText}>No recent jobs found.</Text>
            ) : (
              recentActivityJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => handleJobPress(job)}
                >
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <Text style={styles.jobCompany}>{getCompanyDisplayName(job)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tracked Companies</Text>
            {trackedCompanies.length === 0 ? (
              <Text style={styles.emptyText}>You are not tracking any companies yet.</Text>
            ) : (
              trackedCompanies.map((company) => (
                <View key={company.id} style={styles.companyCard}>
                  <Text style={styles.companyName}>{company.name}</Text>
                  <TouchableOpacity
                    style={styles.companyDeleteButton}
                    onPress={() => handleDeleteCompany(company.id)}
                  >
                    <Text style={styles.companyDeleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <AddCompanyModal
        visible={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        onAddCompany={handleAddCompany}
      />
      <CompanyListModal
        visible={showCompaniesModal}
        onClose={() => setShowCompaniesModal(false)}
        companies={trackedCompanies}
      />
      <JobListModal
        visible={showAllJobsModal}
        onClose={() => setShowAllJobsModal(false)}
        jobs={jobs}
        title="All Jobs"
        onJobPress={handleJobPress}
      />
      <JobListModal
        visible={showPriorityJobsModal}
        onClose={() => setShowPriorityJobsModal(false)}
        jobs={priorityJobs}
        title="Priority Jobs"
        onJobPress={handleJobPress}
      />
      <JobListModal
        visible={showWatchlistJobsModal}
        onClose={() => setShowWatchlistJobsModal(false)}
        jobs={watchlistJobs}
        title="Watchlist Jobs"
        onJobPress={handleJobPress}
      />

      {selectedJob && (
        <Modal
          visible={showJobModal}
          animationType="slide"
          onRequestClose={() => setShowJobModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedJob.title}
              </Text>
              <TouchableOpacity onPress={() => setShowJobModal(false)}>
                <Text style={styles.modalCloseButton}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.jobDetailTitle}>{selectedJob.title}</Text>
              <Text style={styles.jobDetailCompany}>{getCompanyDisplayName(selectedJob)}</Text>
              
              <View style={styles.jobDetailSection}>
                {selectedJob.description && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>📋 Job Description</Text>
                    <Text style={styles.jobDetailDescription}>{selectedJob.description}</Text>
                  </View>
                )}
                
                {selectedJob.salary && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>💰 Salary</Text>
                    <Text style={styles.jobDetailSalary}>{selectedJob.salary}</Text>
                  </View>
                )}
                
                {selectedJob.applicationDeadline && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>⏰ Application Deadline</Text>
                    <Text style={styles.jobDetailDeadline}>
                      {new Date(selectedJob.applicationDeadline).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                
                {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>📚 Requirements</Text>
                    {selectedJob.requirements.map((req, index) => (
                      <Text key={index} style={styles.requirementItem}>• {req}</Text>
                    ))}
                  </View>
                )}
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>🎯 Matched Keywords</Text>
                  <Text style={styles.matchedKeywordsText}>
                    {selectedJob.matchedKeywords?.join(", ") || "N/A"}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>📅 Found On</Text>
                  <Text style={styles.dateFoundText}>
                    {new Date(selectedJob.dateFound).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => Linking.openURL(selectedJob.url)}
                >
                  <Text style={styles.applyButtonText}>🚀 Apply Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteJob(selectedJob.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Delete Job</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
      
      {/* Loading overlay when adding company */}
      {addingCompany && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingOverlayText}>Adding Company...</Text>
            <Text style={styles.loadingOverlaySubtext}>Finding jobs and processing data</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141a1f" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#94A3B8", fontSize: 18 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorTitle: {
    color: "#EF4444",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  errorMessage: {
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: { fontSize: 20, fontWeight: "bold", color: "white" },
  logoutButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutButtonText: { color: "white", fontSize: 14, fontWeight: "600" },
  mainScrollView: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 32 },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    gap: 16,
  },
  statCard: {
    backgroundColor: "#1E293B",
    padding: 20,
    borderRadius: 12,
    flex: 1,
    alignItems: "center",
  },
  statNumber: { fontSize: 32, fontWeight: "bold", color: "#3B82F6" },
  statLabel: { fontSize: 14, color: "#CBD5E1", marginTop: 4 },
  addButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 32,
  },
  addButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
  },
  emptyText: { color: "#94A3B8", textAlign: "center", marginTop: 16 },
  jobCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  jobTitle: { fontSize: 18, fontWeight: "600", color: "white" },
  jobCompany: { fontSize: 14, color: "#94A3B8", marginTop: 4 },
  companyCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  companyName: { fontSize: 16, fontWeight: "600", color: "white" },
  companyDeleteButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  companyDeleteButtonText: { color: "white", fontSize: 12, fontWeight: "600" },
  modalContainer: { flex: 1, backgroundColor: "#141a1f" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginHorizontal: 16,
  },
  modalCloseButton: { color: "#3B82F6", fontSize: 16 },
  modalContent: { padding: 16 },
  jobDetailTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  jobDetailCompany: { 
    fontSize: 16, 
    color: "#94A3B8", 
    marginBottom: 24,
    fontStyle: "italic"
  },
  jobDetailSection: {
    marginBottom: 24,
  },
  detailItem: {
    marginBottom: 16,
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
    marginBottom: 8,
  },
  jobDetailDescription: {
    fontSize: 14,
    color: "#CBD5E1",
    lineHeight: 20,
  },
  jobDetailSalary: {
    fontSize: 16,
    color: "#10B981",
    fontWeight: "600",
  },
  jobDetailDeadline: {
    fontSize: 14,
    color: "#F59E0B",
    fontWeight: "500",
  },
  requirementItem: {
    fontSize: 14,
    color: "#CBD5E1",
    marginLeft: 8,
    marginBottom: 4,
  },
  matchedKeywordsText: {
    fontSize: 14,
    color: "#10B981",
    fontWeight: "500",
  },
  dateFoundText: {
    fontSize: 14,
    color: "#94A3B8",
  },
  buttonContainer: {
    gap: 12,
    marginTop: 16,
  },
  applyButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  applyButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingOverlayText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  loadingOverlaySubtext: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
