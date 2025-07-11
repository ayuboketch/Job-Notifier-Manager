// app/(app)/dashboard.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AddCompanyModal from "../../components/AddCompanyModal";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.100.88:3000/api";

type Company = {
  id: number;
  name: string;
  url: string;
  careerPageUrl: string;
  keywords: string[];
  priority: string;
  checkInterval: number;
  status: string;
  lastChecked: string;
};

type Job = {
  id: number;
  companyId: number;
  company: string;
  title: string;
  url: string;
  status: string;
  priority: string;
  matchedKeywords: string[];
  dateFound: string;
  description: string;
  applicationDeadline: string | null;
};

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

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} - ${errorText}`);
      throw new Error(
        `HTTP ${response.status}: ${errorText || "Request failed"}`
      );
    }

    const data = await response.json();
    console.log("API Response:", data);
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
  const [trackedCompanies, setTrackedCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const priorityJobs = jobs.filter((job) => job.priority === "high");
  const watchlistJobs = jobs.filter(
    (job) => job.priority === "medium" || job.priority === "low"
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setError(null);
      setLoading(true);

      // Test API connection first
      console.log("Testing API connection...");

      const [companiesData, jobsData] = await Promise.all([
        apiRequest(`${API_BASE_URL}/companies`),
        apiRequest(`${API_BASE_URL}/jobs`),
      ]);

      // Handle different response formats
      const companies = Array.isArray(companiesData)
        ? companiesData
        : companiesData.companies || companiesData.data || [];
      const jobs = Array.isArray(jobsData)
        ? jobsData
        : jobsData.jobs || jobsData.data || [];

      setTrackedCompanies(companies);
      setJobs(jobs);

      console.log(
        `Loaded ${companies.length} companies and ${jobs.length} jobs`
      );
    } catch (error) {
      console.error("Failed to fetch data:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch data";
      setError(errorMessage);

      // Show more specific error messages
      if (errorMessage.includes("Network connection failed")) {
        Alert.alert(
          "Connection Error",
          "Cannot connect to the server. Please ensure:\n\n1. Your backend server is running\n2. The API URL is correct\n3. Your device is connected to the internet"
        );
      } else if (errorMessage.includes("HTTP 404")) {
        Alert.alert(
          "API Not Found",
          "The API endpoints are not available. Please check your backend server setup."
        );
      } else {
        Alert.alert("Error", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const handleAddCompany = async (companyData: {
    url: string;
    keywords: string;
    priority: string;
    checkInterval: string;
  }) => {
    try {
      console.log("Adding company:", companyData);

      const result = await apiRequest(`${API_BASE_URL}/companies`, {
        method: "POST",
        body: JSON.stringify(companyData),
      });

      console.log("Add company result:", result);

      if (result.success || result.company) {
        setShowAddCompanyModal(false);
        fetchData(); // Refresh data

        const companyName = result.company?.name || "Company";
        const jobsFound = result.jobsFound || 0;

        Alert.alert(
          "Success!",
          `Added ${companyName} to tracking. Found ${jobsFound} jobs.`
        );
      } else {
        throw new Error(result.error || "Failed to add company");
      }
    } catch (error) {
      console.error("Failed to add company:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add company";
      Alert.alert("Error", errorMessage);
    }
  };

  const handleJobPress = (job: Job) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const handleApplyToJob = async () => {
    if (selectedJob) {
      try {
        await Linking.openURL(selectedJob.url);
      } catch (error) {
        Alert.alert("Error", "Cannot open job application link");
      }
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    try {
      await apiRequest(`${API_BASE_URL}/jobs/${jobId}`, {
        method: "DELETE",
      });

      setJobs(jobs.filter((job) => job.id !== jobId));
      setShowJobModal(false);
      setSelectedJob(null);
      Alert.alert("Success", "Job removed successfully");
    } catch (error) {
      console.error("Failed to delete job:", error);
      Alert.alert("Error", "Failed to delete job");
    }
  };

  const handleCompanyPress = async (company: Company) => {
    try {
      await Linking.openURL(company.url);
    } catch (error) {
      Alert.alert("Error", "Cannot open company website");
    }
  };

  const handleSetPriority = async (companyId: number, priority: string) => {
    try {
      await apiRequest(`${API_BASE_URL}/companies/${companyId}/priority`, {
        method: "PUT",
        body: JSON.stringify({ priority }),
      });

      fetchData(); // Refresh data
      Alert.alert("Success", `Company priority updated to ${priority}`);
    } catch (error) {
      console.error("Failed to update priority:", error);
      Alert.alert("Error", "Failed to update priority");
    }
  };

  const handleDeleteCompany = async (companyId: number) => {
    const company = trackedCompanies.find((c) => c.id === companyId);
    Alert.alert(
      "Delete Company",
      `Stop tracking ${company?.name}? This will also remove all associated jobs.`,
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

              fetchData(); // Refresh data
              Alert.alert("Success", "Company deleted successfully");
            } catch (error) {
              console.error("Failed to delete company:", error);
              Alert.alert("Error", "Failed to delete company");
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
          <Text style={styles.loadingText}>Loading...</Text>
          <Text style={styles.loadingSubtext}>Connecting to server...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Job Tracker Dashboard</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.content}>
          <Text style={styles.welcomeText}>Welcome to your dashboard!</Text>
          <Text style={styles.subtitle}>
            Track job postings from your favorite companies automatically.
          </Text>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statCard}>
              <Text style={styles.statNumber}>{trackedCompanies.length}</Text>
              <Text style={styles.statLabel}>Companies Tracked</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statCard}>
              <Text style={styles.statNumber}>{jobs.length}</Text>
              <Text style={styles.statLabel}>Jobs Found</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddCompanyModal(true)}
          >
            <Text style={styles.addButtonText}>+ Add Company to Track</Text>
          </TouchableOpacity>

          {/* Priority and Watchlist Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statCard}>
              <Text style={styles.statNumber}>{priorityJobs.length}</Text>
              <Text style={styles.statLabel}>Priority List</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statCard}>
              <Text style={styles.statNumber}>{watchlistJobs.length}</Text>
              <Text style={styles.statLabel}>Watchlist</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>

            {jobs.length === 0 ? (
              <Text style={styles.emptyText}>
                No jobs found yet. Add companies to start tracking!
              </Text>
            ) : (
              <ScrollView
                style={styles.scrollList}
                contentContainerStyle={styles.scrollListContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {jobs.map((job) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.jobCard,
                      job.priority === "high" && styles.priorityJobCard,
                    ]}
                    onPress={() => handleJobPress(job)}
                  >
                    <View style={styles.jobCardHeader}>
                      <Text style={styles.jobTitle}>{job.title}</Text>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                      >
                        <Text style={styles.deleteButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.jobDetails}>
                      <Text style={styles.jobCompany}>{job.company}</Text>
                      {job.status === "New" && (
                        <Text style={styles.newBadge}>New</Text>
                      )}
                    </View>
                    <Text style={styles.matchedKeywords}>
                      Matched: {job.matchedKeywords?.join(", ") || "N/A"}
                    </Text>
                    {job.applicationDeadline && (
                      <Text style={styles.deadline}>
                        Deadline:{" "}
                        {new Date(job.applicationDeadline).toLocaleDateString()}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Tracked Companies Section */}
          <View style={styles.additionalSection}>
            <Text style={styles.sectionTitle}>Tracked Companies</Text>
            {trackedCompanies.length === 0 ? (
              <Text style={styles.emptyText}>No companies tracked yet.</Text>
            ) : (
              trackedCompanies.map((company) => (
                <TouchableOpacity
                  key={company.id}
                  style={styles.companyCard}
                  onPress={() => handleCompanyPress(company)}
                >
                  <View style={styles.companyHeader}>
                    <Text style={styles.companyName}>{company.name}</Text>
                    <View style={styles.companyActions}>
                      <TouchableOpacity
                        style={styles.priorityButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          Alert.alert(
                            "Set Priority",
                            "Choose priority level:",
                            [
                              {
                                text: "High",
                                onPress: () =>
                                  handleSetPriority(company.id, "high"),
                              },
                              {
                                text: "Medium",
                                onPress: () =>
                                  handleSetPriority(company.id, "medium"),
                              },
                              {
                                text: "Low",
                                onPress: () =>
                                  handleSetPriority(company.id, "low"),
                              },
                              { text: "Cancel", style: "cancel" },
                            ]
                          );
                        }}
                      >
                        <Text style={styles.priorityButtonText}>Priority</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteCompany(company.id);
                        }}
                      >
                        <Text style={styles.deleteButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.companyDetails}>
                    Keywords: {company.keywords?.join(", ") || "N/A"}
                  </Text>
                  <Text style={styles.companyDetails}>
                    Priority: {company.priority} • Check:{" "}
                    {company.checkInterval}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Job Details Modal */}
      <Modal
        visible={showJobModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJobModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJobModal(false)}>
              <Text style={styles.modalCloseButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Job Details</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedJob && (
              <View style={styles.jobDetailsContainer}>
                <Text style={styles.jobDetailTitle}>{selectedJob.title}</Text>
                <Text style={styles.jobDetailCompany}>
                  {selectedJob.company}
                </Text>

                <View style={styles.jobMetadata}>
                  <Text style={styles.metadataItem}>
                    Keywords: {selectedJob.matchedKeywords?.join(", ") || "N/A"}
                  </Text>
                  <Text style={styles.metadataItem}>
                    Priority: {selectedJob.priority}
                  </Text>
                  <Text style={styles.metadataItem}>
                    Found:{" "}
                    {new Date(selectedJob.dateFound).toLocaleDateString()}
                  </Text>
                  {selectedJob.applicationDeadline && (
                    <Text style={styles.metadataItem}>
                      Deadline:{" "}
                      {new Date(
                        selectedJob.applicationDeadline
                      ).toLocaleDateString()}
                    </Text>
                  )}
                </View>

                <Text style={styles.sectionTitle}>Job Description</Text>
                <Text style={styles.jobDescription}>
                  {selectedJob.description || "No description available"}
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={handleApplyToJob}
                  >
                    <Text style={styles.addButtonText}>Open to Apply</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                      Alert.alert(
                        "Delete Job",
                        "Are you sure you want to remove this job?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => handleDeleteJob(selectedJob.id),
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.deleteButtonText}>Delete Job</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <AddCompanyModal
        visible={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        onAddCompany={handleAddCompany}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141a1f",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 18,
    fontWeight: "500",
  },
  loadingSubtext: {
    color: "#64748B",
    fontSize: 14,
    marginTop: 8,
  },
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
    textAlign: "center",
  },
  errorMessage: {
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  jobMetadata: {
    marginVertical: 12,
    gap: 4,
  },
  jobDetailsContainer: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  jobDetailTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  jobDetailCompany: {
    fontSize: 16,
    color: "#94A3B8",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  logoutButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#CBD5E1",
    marginBottom: 32,
    lineHeight: 24,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: "#1E293B",
    padding: 20,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#3B82F6",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#CBD5E1",
    textAlign: "center",
  },
  addButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 32,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
  },
  scrollList: {
    maxHeight: 500,
    borderRadius: 12,
    padding: 8,
  },
  scrollListContent: {
    paddingBottom: 8,
  },
  jobCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  priorityJobCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  jobCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    flex: 1,
  },
  jobDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  jobCompany: {
    fontSize: 14,
    color: "#94A3B8",
  },
  newBadge: {
    backgroundColor: "#EF4444",
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  matchedKeywords: {
    fontSize: 12,
    color: "#60A5FA",
    fontStyle: "italic",
  },
  deadline: {
    fontSize: 13,
    color: "#FBBF24",
    fontWeight: "500",
    marginTop: 4,
    marginBottom: 2,
  },
  deleteButton: {
    backgroundColor: "#374151",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "bold",
  },
  additionalSection: {
    marginBottom: 32,
  },
  companyCard: {
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  companyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  companyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  companyDetails: {
    fontSize: 14,
    color: "#94A3B8",
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#141a1f",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  modalCloseButton: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "600",
  },
  modalHeaderSpacer: {
    width: 60,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  priorityButton: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
  },
  priorityButtonText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
  },
  applyButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
    flex: 1,
  },
  metadataItem: {
    fontSize: 14,
    color: "#CBD5E1",
    marginBottom: 4,
  },
  jobDescription: {
    fontSize: 15,
    color: "#E5E7EB",
    marginTop: 8,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 12,
  },
});
