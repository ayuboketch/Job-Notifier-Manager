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
import { TrackedWebsite } from "../types";

interface CompanyListModalProps {
  visible: boolean;
  onClose: () => void;
  companies: TrackedWebsite[];
}

export default function CompanyListModal({
  visible,
  onClose,
  companies,
}: CompanyListModalProps) {
  const handleCompanyPress = async (company: TrackedWebsite) => {
    try {
      await Linking.openURL(company.url);
    } catch (error) {
      Alert.alert("Error", "Cannot open company website");
    }
  };

  const handleCareerPagePress = async (company: TrackedWebsite) => {
    try {
      await Linking.openURL(company.career_page_url);
    } catch (error) {
      Alert.alert("Error", "Cannot open career page");
    }
  };

  const formatInterval = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}d`;
  };

  const formatLastChecked = (dateString: string): string => {
    if (!dateString) return "Never";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return `${Math.floor(diffMins / 1440)}d ago`;
    } catch {
      return "Unknown";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#10B981";
      default:
        return "#64748B";
    }
  };

  const getStatusColor = (status: string) => {
    return status === "active" ? "#10B981" : "#64748B";
  };

  return (
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
          <Text style={styles.modalTitle}>Tracked Companies</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView style={styles.modalContent}>
          {companies.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No companies tracked yet</Text>
              <Text style={styles.emptySubtext}>
                Add a company to start tracking jobs!
              </Text>
            </View>
          ) : (
            companies.map((company) => (
              <View key={company.id} style={styles.companyCard}>
                <View style={styles.companyHeader}>
                  <TouchableOpacity
                    style={styles.companyTitleContainer}
                    onPress={() => handleCompanyPress(company)}
                  >
                    <Text style={styles.companyName}>{company.name}</Text>
                    <Text style={styles.companyUrl}>🌐 {company.url}</Text>
                  </TouchableOpacity>

                  <View style={styles.statusBadges}>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityColor(company.priority) },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {company.priority.toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(company.status) },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {company.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.companyDetails}>
                  <Text style={styles.detailItem}>
                    🎯 Keywords: {company.keywords?.join(", ") || "None"}
                  </Text>

                  <Text style={styles.detailItem}>
                    ⏱️ Check every:{" "}
                    {formatInterval(company.check_interval_minutes)}
                  </Text>

                  <Text style={styles.detailItem}>
                    📅 Last checked:{" "}
                    {formatLastChecked(company.last_checked_at)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.careerPageButton}
                  onPress={() => handleCareerPagePress(company)}
                >
                  <Text style={styles.careerPageButtonText}>
                    🚀 View Career Page
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    fontSize: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  emptySubtext: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  companyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  companyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  companyTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  companyUrl: {
    fontSize: 14,
    color: "#60A5FA",
  },
  statusBadges: {
    flexDirection: "row",
    gap: 6,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  companyDetails: {
    marginBottom: 16,
  },
  detailItem: {
    fontSize: 14,
    color: "#CBD5E1",
    marginBottom: 6,
  },
  careerPageButton: {
    backgroundColor: "#374151",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  careerPageButtonText: {
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "600",
  },
});
