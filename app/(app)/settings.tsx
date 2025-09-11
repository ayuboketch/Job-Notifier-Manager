// app/settings.tsx
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back to Dashboard</Text>
        </TouchableOpacity>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.settingsCard} onPress={handleLogout}>
            <Text style={styles.settingsText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings & Preferences</Text>
          <TouchableOpacity style={styles.settingsCard}>
            <Text style={styles.settingsText}>Notification Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsCard}>
            <Text style={styles.settingsText}>Profile Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={styles.quickActionButton}>
              <Text style={styles.quickActionText}>Export Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton}>
              <Text style={styles.quickActionText}>Import Companies</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141a1f",
  },
  scrollContent: {
    padding: 24,
  },
  backButton: {
    color: "#3B82F6",
    fontSize: 16,
    marginBottom: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 12,
  },
  placeholderCard: {
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
  },
  placeholderText: {
    color: "#CBD5E1",
    fontSize: 14,
  },
  settingsCard: {
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingsText: {
    color: "#ffffff",
    fontSize: 16,
  },
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickActionButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  quickActionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
});