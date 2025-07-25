import React from "react";
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

interface JobListModalProps {
  visible: boolean;
  onClose: () => void;
  jobs: JobAlert[];
  title: string;
  onJobPress?: (job: JobAlert) => void;
}

export default function JobListModal({
  visible,
  onClose,
  jobs,
  title,
  onJobPress,
}: JobListModalProps) {
  const [selectedJob, setSelectedJob] = React.useState<JobAlert | null>(null);
  const [showJobDetail, setShowJobDetail] = React.useState(false);
  
  // Helper function to get company display name from various formats
  const getCompanyDisplayName = (job: JobAlert): string => {
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
    return "Unknown Company";
  };

  const handleJobPress = (job: JobAlert) => {
  if (onJobPress) {
    onJobPress(job);
    onClose(); // Close the modal when job is pressed
  } else {
    setSelectedJob(job);
    setShowJobDetail(true);
  }
};

  const handleApplyToJob = async () => {
    if (selectedJob?.url) {
      try {
        await Linking.openURL(selectedJob.url);
      } catch (error) {
        Alert.alert("Error", "Cannot open job application link");
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCloseButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            {jobs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No jobs found</Text>
              </View>
            ) : (
              jobs.map((job) => (
                <TouchableOpacity
                  key={`${title}-job-${job.id}`}
                  style={[
                    styles.jobCard,
                    job.status === "New" && styles.newJobCard,
                  ]}
                  onPress={() => handleJobPress(job)}
                >
                  <View style={styles.jobCardHeader}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    {job.status === "New" && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.jobCompany}>{getCompanyDisplayName(job)}</Text>

                  {job.salary && (
                    <Text style={styles.jobSalary}>💰 {job.salary}</Text>
                  )}

                  {job.applicationDeadline && (
                    <Text style={styles.jobDeadline}>
                      ⏰ Deadline: {formatDate(job.applicationDeadline)}
                    </Text>
                  )}

                  <Text style={styles.matchedKeywords}>
                    🎯 Matched: {job.matchedKeywords?.join(", ") || "N/A"}
                  </Text>

                  <Text style={styles.jobDate}>
                    📅 Found: {formatDate(job.dateFound)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Job Detail Modal */}
      <Modal
        visible={showJobDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJobDetail(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJobDetail(false)}>
              <Text style={styles.modalCloseButton}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Job Details</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedJob && (
              <View style={styles.jobDetailsContainer}>
                <Text style={styles.jobDetailTitle}>{selectedJob.title}</Text>
                <Text style={styles.jobDetailCompany}>
                  {getCompanyDisplayName(selectedJob)}
                </Text>

                <View style={styles.jobMetadata}>
                  {selectedJob.salary && (
                    <Text style={styles.metadataItem}>
                      💰 Salary: {selectedJob.salary}
                    </Text>
                  )}

                  {selectedJob.applicationDeadline && (
                    <Text style={styles.metadataItem}>
                      ⏰ Deadline: {formatDate(selectedJob.applicationDeadline)}
                    </Text>
                  )}

                  <Text style={styles.metadataItem}>
                    🎯 Keywords:{" "}
                    {selectedJob.matchedKeywords?.join(", ") || "N/A"}
                  </Text>

                  <Text style={styles.metadataItem}>
                    📊 Priority: {selectedJob.priority}
                  </Text>

                  <Text style={styles.metadataItem}>
                    📅 Found: {formatDate(selectedJob.dateFound)}
                  </Text>

                  {selectedJob.requirements &&
                    selectedJob.requirements.length > 0 && (
                      <View style={styles.requirementsContainer}>
                        <Text style={styles.metadataItem}>
                          📋 Requirements:
                        </Text>
                        {selectedJob.requirements.map((req, index) => (
                          <Text
                            key={`req-${index}-${req.substring(0, 10)}`}
                            style={styles.requirementItem}
                          >
                            • {req}
                          </Text>
                        ))}
                      </View>
                    )}
                </View>

                <Text style={styles.sectionTitle}>Job Description</Text>
                <Text style={styles.jobDescription}>
                  {selectedJob.description || "No description available"}
                </Text>

                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={handleApplyToJob}
                >
                  <Text style={styles.applyButtonText}>🚀 Apply Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 16,
    fontStyle: "italic",
  },
  jobCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  newJobCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
  },
  jobCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    flex: 1,
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  newBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  jobCompany: {
    fontSize: 14,
    color: "#94A3B8",
    marginBottom: 6,
  },
  jobSalary: {
    fontSize: 14,
    color: "#10B981",
    marginBottom: 4,
    fontWeight: "500",
  },
  jobDeadline: {
    fontSize: 14,
    color: "#F59E0B",
    marginBottom: 4,
    fontWeight: "500",
  },
  matchedKeywords: {
    fontSize: 12,
    color: "#60A5FA",
    fontStyle: "italic",
    marginBottom: 4,
  },
  jobDate: {
    fontSize: 12,
    color: "#64748B",
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
    marginBottom: 16,
  },
  jobMetadata: {
    marginBottom: 20,
  },
  metadataItem: {
    fontSize: 14,
    color: "#CBD5E1",
    marginBottom: 6,
  },
  requirementsContainer: {
    marginTop: 8,
  },
  requirementItem: {
    fontSize: 14,
    color: "#94A3B8",
    marginLeft: 8,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
  },
  jobDescription: {
    fontSize: 15,
    color: "#E5E7EB",
    lineHeight: 22,
    marginBottom: 24,
  },
  applyButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  applyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
