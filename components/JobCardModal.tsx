import React, { useCallback } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { apiRequest } from "../app/(app)/dashboard";
import { JobAlert } from "../types";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

interface JobCardModalProps {
  visible: boolean;
  onClose: () => void;
  job: JobAlert | null;
}

const JobCardModal: React.FC<JobCardModalProps> = ({
  visible,
  onClose,
  job,
}) => {
  if (!job) {
    return null;
  }

  const API_BASE_URL = process.env["EXPO_PUBLIC_API_BASE_URL"]!;

  const handleLinkPress = useCallback((url: string | undefined) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        console.error("Couldn't load page", err)
      );
    }
  }, []);

  const handleApply = async (selectedJob: JobAlert) => {
    await apiRequest(`${API_BASE_URL}/jobs/${selectedJob.id}/apply`, {
      method: "POST",
    });
    await Linking.openURL(selectedJob.url);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <ThemedView style={styles.centeredView}>
        <ThemedView style={styles.modalView}>
          <ScrollView>
            <TouchableOpacity onPress={() => handleLinkPress(job.url)}>
              <ThemedText style={styles.modalTitle}>{job.title}</ThemedText>
            </TouchableOpacity>

            {job.company?.name && (
              <ThemedText style={styles.modalText}>
                <ThemedText style={styles.boldText}>Company:</ThemedText>{" "}
                {job.company.name}
              </ThemedText>
            )}
            {job.salary && (
              <ThemedText style={styles.modalText}>
                <ThemedText style={styles.boldText}>Salary:</ThemedText>{" "}
                {job.salary}
              </ThemedText>
            )}
            {job.dateFound && (
              <ThemedText style={styles.modalText}>
                <ThemedText style={styles.boldText}>Posted Date:</ThemedText>{" "}
                {new Date(job.dateFound).toLocaleDateString()}
              </ThemedText>
            )}
            {job.location && (
              <ThemedText style={styles.modalText}>
                <ThemedText style={styles.boldText}>Location:</ThemedText>{" "}
                {job.location || "N/A"}
              </ThemedText>
            )}

            <ThemedText style={styles.modalDescriptionTitle}>
              Description:
            </ThemedText>
            <TouchableOpacity onPress={() => handleLinkPress(job.url)}>
              <ThemedText style={styles.modalDescription}>
                {job.description || "No description available."}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => handleApply(job)}>
              <ThemedText style={styles.buttonText}>Apply</ThemedText>
            </TouchableOpacity>
          </ScrollView>
          <TouchableOpacity
            style={[styles.button, styles.buttonClose]}
            onPress={onClose}
          >
            <ThemedText style={styles.buttonText}>Close</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "90%",
    maxHeight: "80%",
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
  },
  modalText: {
    marginBottom: 10,
    textAlign: "center",
    fontSize: 16,
  },
  boldText: {
    fontWeight: "bold",
  },
  modalDescriptionTitle: {
    marginTop: 15,
    marginBottom: 5,
    fontSize: 18,
    fontWeight: "bold",
  },
  modalDescription: {
    marginBottom: 20,
    textAlign: "left",
    fontSize: 14,
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginTop: 10,
    backgroundColor: "#2196F3", // Example color
  },
  buttonClose: {
    backgroundColor: "#FF6347", // Example color for close button
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default JobCardModal;
