import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, Linking, ScrollView } from 'react-native';
import { JobAlert } from '../types';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface JobCardModalProps {
  visible: boolean;
  onClose: () => void;
  job: JobAlert | null;
}

const JobCardModal: React.FC<JobCardModalProps> = ({ visible, onClose, job }) => {
  if (!job) {
    return null;
  }

  const handleLinkPress = (url: string | undefined) => {
    if (url) {
      Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    }
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
            <TouchableOpacity onPress={() => handleLinkPress(job.job_url)}>
              <ThemedText style={styles.modalTitle}>{job.job_title}</ThemedText>
            </TouchableOpacity>

            {job.tracked_website?.company_name && (
              <ThemedText style={styles.modalText}>
                <ThemedText style={styles.boldText}>Company:</ThemedText> {job.tracked_website.company_name}
              </ThemedText>
            )}
            {job.salary_range && (
              <ThemedText style={styles.modalText}>
                <ThemedText style={styles.boldText}>Salary:</ThemedText> {job.salary_range}
              </ThemedText>
            )}
            {job.posted_date && (
              <ThemedText style={styles.modalText}>
                <ThemedText style={styles.boldText}>Posted Date:</ThemedText> {job.posted_date}
              </ThemedText>
            )}
            {job.location && (
              <ThemedText style={styles.modalText}>
                <ThemedText style={styles.boldText}>Location:</ThemedText> {job.location}
              </ThemedText>
            )}

            <ThemedText style={styles.modalDescriptionTitle}>Description:</ThemedText>
            <TouchableOpacity onPress={() => handleLinkPress(job.job_url)}>
              <ThemedText style={styles.modalDescription}>{job.job_description}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={() => handleLinkPress(job.job_url)} // Assuming job_url is also the application link for now
            >
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
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalText: {
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 16,
  },
  boldText: {
    fontWeight: 'bold',
  },
  modalDescriptionTitle: {
    marginTop: 15,
    marginBottom: 5,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDescription: {
    marginBottom: 20,
    textAlign: 'left',
    fontSize: 14,
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginTop: 10,
    backgroundColor: '#2196F3', // Example color
  },
  buttonClose: {
    backgroundColor: '#FF6347', // Example color for close button
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default JobCardModal;
