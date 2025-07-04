import React, { useState } from "react";
import {
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
  }) => void;
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
  const [isSearchingCareerPage, setIsSearchingCareerPage] = useState(false);

  const handleAddCompany = async () => {
    if (!companyUrl.trim()) {
      Alert.alert("Error", "Please enter a company URL");
      return;
    }

    if (!jobKeywords.trim()) {
      Alert.alert("Error", "Please enter job keywords to track");
      return;
    }

    setIsSearchingCareerPage(true);

    try {
      // Pass data back to parent
      onAddCompany({
        url: companyUrl,
        keywords: jobKeywords,
        priority,
        checkInterval,
      });

      // Reset form
      setCompanyUrl("");
      setJobKeywords("");
      setPriority("medium");
      setCheckInterval("1 day");
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to add company. Please check the URL and try again."
      );
    } finally {
      setIsSearchingCareerPage(false);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setCompanyUrl("");
    setJobKeywords("");
    setPriority("medium");
    setCheckInterval("1 day");
    setIsSearchingCareerPage(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Company</Text>
            <TouchableOpacity
              onPress={handleAddCompany}
              disabled={isSearchingCareerPage}
            >
              <Text
                style={[
                  styles.modalSaveButton,
                  isSearchingCareerPage && styles.disabledButton,
                ]}
              >
                {isSearchingCareerPage ? "Searching..." : "Add"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formSection}>
              <Text style={styles.label}>Company Website URL *</Text>
              <TextInput
                style={styles.input}
                value={companyUrl}
                onChangeText={setCompanyUrl}
                placeholder="https://company.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.helpText}>
                We'll automatically find their career page
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Job Keywords *</Text>
              <TextInput
                style={styles.input}
                value={jobKeywords}
                onChangeText={setJobKeywords}
                placeholder="frontend, react, javascript, intern"
                placeholderTextColor="#94A3B8"
                multiline
              />
              <Text style={styles.helpText}>
                Separate keywords with commas. We'll notify you when jobs
                contain these terms.
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Priority Level</Text>
              <View style={styles.priorityContainer}>
                {["high", "medium", "low"].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.priorityButton,
                      priority === level && styles.priorityButtonActive,
                    ]}
                    onPress={() => setPriority(level)}
                  >
                    <Text
                      style={[
                        styles.priorityButtonText,
                        priority === level && styles.priorityButtonTextActive,
                      ]}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Check Frequency</Text>
              <View style={styles.frequencyContainer}>
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
                      styles.frequencyButton,
                      checkInterval === freq && styles.frequencyButtonActive,
                    ]}
                    onPress={() => setCheckInterval(freq)}
                  >
                    <Text
                      style={[
                        styles.frequencyButtonText,
                        checkInterval === freq &&
                          styles.frequencyButtonTextActive,
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
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  modalCancelButton: {
    color: "#94A3B8",
    fontSize: 16,
  },
  modalSaveButton: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    color: "#64748B",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formSection: {
    marginBottom: 24,
  },
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
    padding: 12,
    color: "white",
    fontSize: 16,
  },
  helpText: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 6,
  },
  priorityContainer: {
    flexDirection: "row",
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  priorityButtonActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  priorityButtonText: {
    color: "#94A3B8",
    fontWeight: "500",
  },
  priorityButtonTextActive: {
    color: "white",
  },
  frequencyContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  frequencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  frequencyButtonActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  frequencyButtonText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  frequencyButtonTextActive: {
    color: "white",
  },
});
