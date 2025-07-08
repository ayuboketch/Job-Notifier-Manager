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
  TextInput,
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
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const router = useRouter();
  const { signUp } = useAuth();

  const handleInputChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      const { [name]: removed, ...rest } = errors;
      setErrors(rest);
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    if (!formData.fullName.trim())
      newErrors.fullName = "Full name is required.";
    if (!formData.email.trim()) newErrors.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Email is invalid.";
    if (!formData.password) newErrors.password = "Password is required.";
    else if (formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters.";
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match.";

    setErrors(newErrors);
    console.log("🔍 Validation Errors:", newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    console.log("🚀 Starting signup with data:", formData);

    if (!validateForm()) {
      console.log("⛔ Form validation failed.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signUp(
        formData.email,
        formData.password,
        formData.fullName
      );

      console.log("✅ Signup result:", result);
      setIsLoading(false);

      if (result.success) {
        setShowVerificationPrompt(true);
      } else {
        if (result.message.includes("User already registered")) {
          Alert.alert(
            "Account Exists",
            "This email already has an associated account, please log in.",
            [
              {
                text: "Go to Login",
                onPress: () => router.push("/(auth)/login"),
              },
              { text: "Cancel", style: "cancel" },
            ]
          );
        } else {
          Alert.alert("Signup Failed", result.message);
        }
      }
    } catch (error) {
      console.error("❌ Unexpected error during signup:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowVerificationPrompt(false);
    router.push("/(auth)/login");
  };

  if (showVerificationPrompt) {
    return (
      <View style={styles.container}>
        <AnimatedGradientBackground>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.verificationContainer}>
              <View style={styles.verificationContent}>
                <Text style={styles.verificationTitle}>Check Your Email</Text>
                <Text style={styles.verificationText}>
                  We've sent a verification link to your inbox. Please click the
                  link to activate your account, then return to the login
                  screen.
                </Text>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBackToLogin}
                >
                  <Text style={styles.backButtonText}>Go to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </AnimatedGradientBackground>
      </View>
    );
  }

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
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={[styles.input, errors.fullName && styles.inputError]}
                    value={formData.fullName}
                    onChangeText={(text) => handleInputChange("fullName", text)}
                    placeholder="Enter your full name"
                    placeholderTextColor="#64748B"
                    autoCapitalize="words"
                  />
                  {errors.fullName && (
                    <Text style={styles.errorText}>{errors.fullName}</Text>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={[styles.input, errors.email && styles.inputError]}
                    value={formData.email}
                    onChangeText={(text) => handleInputChange("email", text)}
                    placeholder="Enter your email"
                    placeholderTextColor="#64748B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  {errors.email && (
                    <Text style={styles.errorText}>{errors.email}</Text>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={[styles.input, errors.password && styles.inputError]}
                    value={formData.password}
                    onChangeText={(text) => handleInputChange("password", text)}
                    placeholder="Create a password"
                    placeholderTextColor="#64748B"
                    secureTextEntry
                  />
                  {errors.password && (
                    <Text style={styles.errorText}>{errors.password}</Text>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={[
                      styles.input,
                      errors.confirmPassword && styles.inputError,
                    ]}
                    value={formData.confirmPassword}
                    onChangeText={(text) =>
                      handleInputChange("confirmPassword", text)
                    }
                    placeholder="Confirm your password"
                    placeholderTextColor="#64748B"
                    secureTextEntry
                  />
                  {errors.confirmPassword && (
                    <Text style={styles.errorText}>
                      {errors.confirmPassword}
                    </Text>
                  )}
                </View>

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
  container: { flex: 1, backgroundColor: "#141a1f" },
  keyboardContainer: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  headerContainer: { paddingBottom: 40, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "white", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#CBD5E1", textAlign: "center" },
  formContainer: { flex: 1 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", color: "white", marginBottom: 8 },
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
  inputError: { borderColor: "#EF4444", borderWidth: 2 },
  errorText: { color: "#EF4444", fontSize: 14, marginTop: 4, marginLeft: 4 },
  signupButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    minHeight: 52,
  },
  signupButtonDisabled: { backgroundColor: "#64748B" },
  signupButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  loginText: { color: "#CBD5E1", fontSize: 16 },
  loginLink: { color: "#3B82F6", fontSize: 16, fontWeight: "600" },
  linkDisabled: { color: "#64748B" },
  verificationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  verificationContent: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  verificationTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 16,
    textAlign: "center",
  },
  verificationText: {
    fontSize: 16,
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
