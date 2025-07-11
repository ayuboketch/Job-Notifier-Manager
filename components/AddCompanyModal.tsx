import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface AddCompanyModalProps {
  visible: boolean;
  onClose: () => void;
  onAddCompany: (companyData: {
    url: string;
    keywords: string;
    priority: string;
    checkInterval: string;
  }) => Promise<void>;
}

export default function AddCompanyModal({
  visible,
  onClose,
  onAddCompany,
}: AddCompanyModalProps) {
  const [companyUrl, setCompanyUrl] = useState("");
  const [jobKeywords, setJobKeywords] = useState("");
  const [priority, setPriority] = useState("medium");
  const [checkInterval, setCheckInterval] = useState("1 day");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const formatUrl = (url: string): string => {
    if (!url) return url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  };

  const handleAddCompany = async () => {
    setError(null);
    if (!companyUrl.trim()) {
      setError("Please enter a company URL");
      return;
    }
    if (!jobKeywords.trim()) {
      setError("Please enter job keywords to track");
      return;
    }

    const formattedUrl = formatUrl(companyUrl.trim());
    if (!validateUrl(formattedUrl)) {
      setError("Please enter a valid URL (e.g., https://company.com)");
      return;
    }

    setIsProcessing(true);
    try {
      await onAddCompany({
        url: formattedUrl,
        keywords: jobKeywords.trim(),
        priority,
        checkInterval,
      });
      handleClose();
    } catch (err: any) {
      setError(
        err.message?.includes("Network")
          ? "Network error. Please check your connection and try again."
          : err.message || "Something went wrong"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) {
      Alert.alert("Processing", "Company is being added. Please wait...");
      return;
    }
    setCompanyUrl("");
    setJobKeywords("");
    setPriority("medium");
    setCheckInterval("1 day");
    setError(null);
    setIsProcessing(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} disabled={isProcessing}>
              <Text
                style={[
                  styles.modalCancelButton,
                  isProcessing && styles.disabledText,
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Add Company</Text>

            <TouchableOpacity
              onPress={handleAddCompany}
              disabled={
                isProcessing || !companyUrl.trim() || !jobKeywords.trim()
              }
            >
              <Text
                style={[
                  styles.modalSaveButton,
                  (isProcessing || !companyUrl.trim() || !jobKeywords.trim()) &&
                    styles.disabledButton,
                ]}
              >
                {isProcessing ? "Adding..." : "Add"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading */}
          {isProcessing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>
                Finding career page and scraping jobs...
              </Text>
              <Text style={styles.loadingSubtext}>This may take a moment</Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.section}>
              <Text style={styles.label}>Company Website URL *</Text>
              <TextInput
                style={styles.input}
                value={companyUrl}
                onChangeText={(t) => {
                  setCompanyUrl(t);
                  setError(null);
                }}
                placeholder="https://company.com or company.com"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                keyboardType="url"
                editable={!isProcessing}
              />
              <Text style={styles.helpText}>
                We’ll automatically find their career page
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Job Keywords *</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={jobKeywords}
                onChangeText={(t) => {
                  setJobKeywords(t);
                  setError(null);
                }}
                placeholder="frontend, react, javascript, intern"
                placeholderTextColor="#64748B"
                multiline
                editable={!isProcessing}
              />
              <Text style={styles.helpText}>
                Separate with commas. We’ll notify you when jobs match.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Priority Level</Text>
              <View style={styles.chipRow}>
                {["high", "medium", "low"].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.chip,
                      priority === level && styles.chipActive,
                    ]}
                    onPress={() => setPriority(level)}
                    disabled={isProcessing}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        priority === level && styles.chipTextActive,
                      ]}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Check Frequency</Text>
              <View style={styles.chipRow}>
                {["1 hour", "2 hours", "3 hours", "1 day", "2 days", "1 week"].map(
                  (freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.chip,
                        checkInterval === freq && styles.chipActive,
                      ]}
                      onPress={() => setCheckInterval(freq)}
                      disabled={isProcessing}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          checkInterval === freq && styles.chipTextActive,
                        ]}
                      >
                        {freq}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
              <Text style={styles.helpText}>
                Higher priority = more frequent checks
              </Text>
            </View>

            {/* Extra bottom padding */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: "#141a1f" },

  /* Header */
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "white" },
  modalCancelButton: { color: "#94A3B8", fontSize: 16 },
  modalSaveButton: { color: "#3B82F6", fontSize: 16, fontWeight: "600" },
  disabledButton: { color: "#64748B" },
  disabledText: { color: "#64748B" },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  /* Sections */
  section: { marginBottom: 28 },

  /* Inputs */
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    fontSize: 16,
    minHeight: 48,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  helpText: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 6,
  },

  /* Chips */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1E293B",
  },
  chipActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  chipText: { color: "#94A3B8", fontSize: 14, fontWeight: "500" },
  chipTextActive: { color: "white" },

  /* Loading / Error */
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  loadingText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
  },
  loadingSubtext: { color: "#94A3B8", fontSize: 14, marginTop: 4 },
  errorContainer: {
    backgroundColor: "#DC2626",
    padding: 12,
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 8,
  },
  errorText: { color: "white", fontSize: 14, fontWeight: "500", textAlign: "center" },
});