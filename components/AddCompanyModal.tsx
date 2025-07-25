//components/addCompanyModal.ts
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
    careerPageUrl?: string;
    keywords: string;
    priority: string;
    checkInterval: string;
  }) => Promise<void>;
  onCompanyAdded?: () => void;
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
  const [careerPageUrl, setCareerPageUrl] = useState("");
  const [progress, setProgress] = useState<null | string>(null);

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
  const extractCompanyName = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace("www.", "").split(".")[0];
    } catch {
      return "company";
    }
  };

  // 2.  handleAddCompany with live messages
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

    // auto-prefill
    let formattedUrl = companyUrl.trim();
    if (!formattedUrl.startsWith("http")) {
      formattedUrl = `https://www.${formattedUrl}`;
    }
    if (!validateUrl(formattedUrl)) {
      setError("Please enter a valid URL");
      return;
    }

    setIsProcessing(true);
    setProgress("🔍 Finding career page..."); // initial

    // More informative progress messages
    const messages = [
      "🌐 Accessing company website...",
      "🔎 Scanning for job listings...",
      "⚡ Processing job data...",
      "📊 Matching keywords...",
      "✨ Almost finished...",
    ];
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < messages.length) {
        setProgress(messages[idx++]);
      }
    }, 4000); // Reduced interval for more frequent updates

    try {
      await onAddCompany({
        url: formattedUrl,
        careerPageUrl: careerPageUrl.trim()
          ? `${formattedUrl}${careerPageUrl.trim()}`
          : undefined,
        keywords: jobKeywords.trim(),
        priority,
        checkInterval,
      });
      clearInterval(timer);
      setProgress("✅ Success! Jobs found and added.");
      // Brief delay to show success message
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      clearInterval(timer);
      setProgress(null);
      setError(
        err.message?.includes("Network")
          ? "🌐 Network error. Please check your connection and try again."
          : err.message?.includes("Timeout")
          ? "⏱️ Taking longer than expected. The site might be slow or protected. Try using a direct career page URL."
          : err.message || "❌ Something went wrong. Please try again."
      );
    } finally {
      if (!progress?.includes("Success!")) {
        setIsProcessing(false);
        setProgress(null);
      }
    }
  };

  // 3.  overlay component
  const ProgressOverlay = () =>
    progress ? (
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.overlayText}>{progress}</Text>
      </View>
    ) : null;

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
                {progress || "Processing..."}
              </Text>
              <Text style={styles.loadingSubtext}>
                {progress?.includes("Success!") 
                  ? "Redirecting to dashboard..." 
                  : "This may take 30-60 seconds"}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min((Date.now() % 60000) / 600, 100)}%` }]} />
              </View>
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
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>https://www.</Text>
                <TextInput
                  style={styles.inputField}
                  value={companyUrl}
                  onChangeText={(t) => {
                    setCompanyUrl(t.replace(/^(https?:\/\/)?(www\.)?/, ''));
                    setError(null);
                  }}
                  placeholder="company.com"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  keyboardType="url"
                  editable={!isProcessing}
                />
              </View>
              <Text style={styles.helpText}>
                We’ll automatically fill it in career page
              </Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>Career / Jobs URL </Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix} numberOfLines={1} ellipsizeMode="tail">
                  {companyUrl ? `https://www.${companyUrl}` : 'https://www.company.com'}
                </Text>
                <TextInput
                  style={styles.inputField}
                  value={careerPageUrl}
                  onChangeText={(t) => setCareerPageUrl(t)}
                  placeholder="/jobs or /search"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  keyboardType="url"
                  editable={!isProcessing}
                />
              </View>
              <Text style={styles.helpText}>
                Just put the exact page like "/careers" or "/jobs" for easier
                detection.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Job Keywords *</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
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
                {[
                  "1 hour",
                  "2 hours",
                  "3 hours",
                  "1 day",
                  "2 days",
                  "1 week",
                ].map((freq) => (
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
                ))}
              </View>
              <Text style={styles.helpText}>
                Higher priority = more frequent checks
              </Text>
            </View>

            {/* Extra bottom padding */}
            <View style={{ height: 40 }} />
          </ScrollView>
          <ProgressOverlay />
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
  textInput: {
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
  },
  inputPrefix: {
    color: '#94A3B8',
    fontSize: 16,
    paddingLeft: 14,
  },
  inputField: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: 'white',
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
  errorText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#141a1fe6",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  overlayText: {
    color: "white",
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
  },
  progressBar: {
    width: "80%",
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 2,
  },
});
