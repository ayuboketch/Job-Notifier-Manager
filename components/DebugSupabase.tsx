// components/DebugSupabase.tsx
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function DebugSupabase() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    checkSupabaseConnection();
  }, []);

  const checkSupabaseConnection = async () => {
    const info: any = {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "NOT SET",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
        ? "SET"
        : "NOT SET",
      timestamp: new Date().toISOString(),
    };

    try {
      // Test basic connection
      const { data, error } = await supabase.auth.getSession();
      info.connectionTest = error ? `Error: ${error.message}` : "SUCCESS";
      info.currentSession = data.session ? "Has session" : "No session";
    } catch (error: any) {
      info.connectionTest = `Exception: ${error.message}`;
    }

    setDebugInfo(info);
  };

  const testSignUp = async () => {
    console.log("Testing signup...");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: "test@example.com",
        password: "testpassword123",
        options: {
          data: {
            full_name: "Test User",
          },
        },
      });

      console.log("Signup result:", { data, error });
      alert(`Signup test: ${error ? error.message : "Success"}`);
    } catch (error: any) {
      console.error("Signup test error:", error);
      alert(`Signup test error: ${error.message}`);
    }
  };

  const testConnection = async () => {
    console.log("Testing connection...");
    try {
      const { data, error } = await supabase.auth.getUser();
      console.log("Connection test result:", { data, error });
      alert(`Connection test: ${error ? error.message : "Success"}`);
    } catch (error: any) {
      console.error("Connection test error:", error);
      alert(`Connection test error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supabase Debug Info</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.label}>Supabase URL:</Text>
        <Text style={styles.value}>{debugInfo.supabaseUrl}</Text>

        <Text style={styles.label}>Anon Key:</Text>
        <Text style={styles.value}>{debugInfo.supabaseAnonKey}</Text>

        <Text style={styles.label}>Connection Test:</Text>
        <Text style={styles.value}>{debugInfo.connectionTest}</Text>

        <Text style={styles.label}>Current Session:</Text>
        <Text style={styles.value}>{debugInfo.currentSession}</Text>

        <Text style={styles.label}>Last Check:</Text>
        <Text style={styles.value}>{debugInfo.timestamp}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={testConnection}>
        <Text style={styles.buttonText}>Test Connection</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testSignUp}>
        <Text style={styles.buttonText}>Test Signup</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={checkSupabaseConnection}>
        <Text style={styles.buttonText}>Refresh Debug Info</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#1E293B",
    margin: 20,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 15,
  },
  infoContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#CBD5E1",
    marginTop: 10,
  },
  value: {
    fontSize: 12,
    color: "white",
    backgroundColor: "#334155",
    padding: 5,
    borderRadius: 5,
    marginTop: 2,
  },
  button: {
    backgroundColor: "#3B82F6",
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },
});
