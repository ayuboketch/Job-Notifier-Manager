import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiWithAuth } from "../../lib/api";
import { JobAlert } from "../../types";

export default function RecentActivity() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobAlert | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const fetchedJobs = await apiWithAuth.getJobs();
        setJobs(Array.isArray(fetchedJobs) ? fetchedJobs : []);
      } catch (_err) {
        setError("Failed to fetch jobs.");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const handleJobPress = (job: JobAlert) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const getCompanyDisplayName = (job: any): string => {
    if (job.companyName) return job.companyName;
    if (job.company && typeof job.company === "object" && job.company.name)
      return job.company.name;
    if (job.company && typeof job.company === "string") return job.company;
    return job.company_name || "Unknown Company";
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#141a1f" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back to Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Recent Activity</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : jobs.length === 0 ? (
          <Text style={styles.errorText}>No recent jobs found.</Text>
        ) : (
          jobs.map((job) => (
            <TouchableOpacity key={job.id} onPress={() => handleJobPress(job)}>
              <View style={styles.jobCard}>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <Text style={styles.jobCompany}>
                  {getCompanyDisplayName(job)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

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
              <Text style={styles.jobDetailCompany}>
                {getCompanyDisplayName(selectedJob)}
              </Text>

              <View style={styles.jobDetailSection}>
                {selectedJob.description && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>📋 Job Description</Text>
                    <Text style={styles.jobDetailDescription}>
                      {selectedJob.description}
                    </Text>
                  </View>
                )}

                {selectedJob.salary && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>💰 Salary</Text>
                    <Text style={styles.jobDetailSalary}>
                      {selectedJob.salary}
                    </Text>
                  </View>
                )}

                {selectedJob.applicationDeadline && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>
                      ⏰ Application Deadline
                    </Text>
                    <Text style={styles.jobDetailDeadline}>
                      {new Date(
                        selectedJob.applicationDeadline
                      ).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                {selectedJob.requirements?.length > 0 && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>📚 Requirements</Text>
                    {selectedJob.requirements.map(
                      (
                        req:
                          | string
                          | number
                          | bigint
                          | boolean
                          | React.ReactElement<
                              unknown,
                              string | React.JSXElementConstructor<any>
                            >
                          | Iterable<React.ReactNode>
                          | React.ReactPortal
                          | Promise<
                              | string
                              | number
                              | bigint
                              | boolean
                              | React.ReactPortal
                              | React.ReactElement<
                                  unknown,
                                  string | React.JSXElementConstructor<any>
                                >
                              | Iterable<React.ReactNode>
                              | null
                              | undefined
                            >
                          | null
                          | undefined,
                        i: React.Key | null | undefined
                      ) => (
                        <Text
                          key={i as React.Key}
                          style={styles.requirementItem}
                        >
                          • {req}
                        </Text>
                      )
                    )}
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
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#141a1f",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 16,
  },
  backButton: {
    color: "#3B82F6",
    fontSize: 16,
    marginBottom: 16,
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
  jobCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  jobTitle: { fontSize: 18, fontWeight: "600", color: "white" },
  jobCompany: { fontSize: 14, color: "#94A3B8", marginTop: 4 },
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
    fontStyle: "italic",
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
    paddingBottom: 24,
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
});
("");
