// app/(app)/recent.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiWithAuth } from "../../lib/api";
import { JobAlert } from "../../types";

export default function RecentActivityTab() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentJobs = async () => {
      try {
        const fetchedJobs = await apiWithAuth.getJobs();
        // Get only the 5 most recent jobs for the tab
        const recentJobs = Array.isArray(fetchedJobs)
          ? fetchedJobs
              .sort(
                (a, b) =>
                  new Date(b.dateFound).getTime() -
                  new Date(a.dateFound).getTime()
              )
              .slice(0, 5)
          : [];
        setJobs(recentJobs);
      } catch (_err) {
        setError("Failed to fetch recent jobs.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecentJobs();
  }, []);

  const getCompanyDisplayName = (job: any): string => {
    if (job.companyName) return job.companyName;
    if (job.company && typeof job.company === "object" && job.company.name)
      return job.company.name;
    if (job.company && typeof job.company === "string") return job.company;
    return job.company_name || "Unknown Company";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
        <TouchableOpacity
          onPress={() => router.push("/(app)/RecentActivity")}
          style={styles.seeAllButton}
        >
          <Text style={styles.seeAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading recent jobs...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : jobs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recent jobs found.</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/(app)/dashboard")}
            >
              <Text style={styles.addButtonText}>
                Add Companies to Start Tracking
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>Last 5 jobs found</Text>
            {jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => router.push("/(app)/RecentActivity")}
              >
                <View style={styles.jobHeader}>
                  <Text style={styles.jobTitle} numberOfLines={2}>
                    {job.title}
                  </Text>
                  <Text style={styles.jobDate}>
                    {new Date(job.dateFound).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.jobCompany}>
                  {getCompanyDisplayName(job)}
                </Text>
                {job.matchedKeywords && job.matchedKeywords.length > 0 && (
                  <Text style={styles.keywords}>
                    Keywords: {job.matchedKeywords.slice(0, 3).join(", ")}
                  </Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push("/(app)/RecentActivity")}
            >
              <Text style={styles.viewAllButtonText}>
                View All {jobs.length > 5 ? `${jobs.length} ` : ""}Jobs →
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141a1f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  seeAllButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  seeAllText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "#94A3B8",
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    color: "#94A3B8",
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 16,
    marginTop: 50,
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
    textAlign: "center",
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  jobCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  jobHeader: {
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
    marginRight: 12,
  },
  jobDate: {
    fontSize: 12,
    color: "#94A3B8",
  },
  jobCompany: {
    fontSize: 14,
    color: "#94A3B8",
    marginBottom: 8,
  },
  keywords: {
    fontSize: 12,
    color: "#10B981",
    fontStyle: "italic",
  },
  viewAllButton: {
    backgroundColor: "#1E293B",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  viewAllButtonText: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "600",
  },
});
