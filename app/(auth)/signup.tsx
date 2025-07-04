// app/(auth)/signup.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedGradientBackground from "../../components/AnimatedGradientBackground";
import { useAuth } from "../../context/AuthContext";
import { FormErrors } from "../../types";

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const router = useRouter();
  const { signUp } = useAuth();

  // Your validateForm and handleInputChange functions remain the same

  const handleSignup = async () => {
    // if (!validateForm()) return; // Assuming you have this function
    setIsLoading(true);
    const result = await signUp(
      formData.email,
      formData.password,
      formData.fullName
    );
    setIsLoading(false);

    if (result.success) {
      Alert.alert(
        "Success!",
        "Please check your email to verify your account."
      );
    } else {
      Alert.alert("Signup Failed", result.message);
    }
    // NO router.push()! The layout will handle navigation after verification.
  };

  return (
    <View style={styles.container}>
      <AnimatedGradientBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardContainer}
          >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
              <View style={styles.headerContainer}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  Start tracking your dream jobs today
                </Text>
              </View>

              <View style={styles.formContainer}>
                {/* Your form inputs here */}
                <TouchableOpacity
                  style={[
                    styles.signupButton,
                    isLoading && styles.signupButtonDisabled,
                  ]}
                  onPress={handleSignup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.signupButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(auth)/login")}
                    disabled={isLoading}
                  >
                    <Text
                      style={[
                        styles.loginLink,
                        isLoading && styles.linkDisabled,
                      ]}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </AnimatedGradientBackground>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141a1f",
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  headerContainer: {
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#CBD5E1",
    textAlign: "center",
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
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
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "white",
  },
  inputError: {
    borderColor: "#EF4444",
    borderWidth: 2,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
  signupButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    minHeight: 52,
  },
  signupButtonDisabled: {
    backgroundColor: "#64748B",
  },
  signupButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  loginText: {
    color: "#CBD5E1",
    fontSize: 16,
  },
  loginLink: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "600",
  },
  linkDisabled: {
    color: "#64748B",
  },
});
