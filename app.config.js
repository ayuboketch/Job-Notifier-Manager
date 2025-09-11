// app.config.js
export default {
  expo: {
    name: "Job Notifier Manager",
    slug: "job-notifier-manager",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "jobtracker",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    icon: "./assets/images/Job-Notifier-Manager.png",
    
    splash: {
      image: "./assets/images/Job-Notifier-Manager.png",
      resizeMode: "contain",
      backgroundColor: "#0a06067c",
    },

    ios: {
      bundleIdentifier: "com.anonymous.jobnotifiermanager",
      supportsTablet: true,
      statusBarStyle: "light",
    },

    android: {
      package: "com.anonymous.jobnotifiermanager",
      adaptiveIcon: {
        foregroundImage: "./assets/images/Job-Notifier-Manager.png",
        backgroundColor: "#0c0808",
      },
      statusBar: {
        barStyle: "light-content",
        backgroundColor: "#141a1f",
      },
    },

    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/Job-Notifier-Manager.png",
    },

    plugins: ["expo-router"],

    experiments: {
      typedRoutes: true,
    },
    usesCleartextTraffic: true, // Allow cleartext traffic for development

    // FIX: The 'extra' block is removed.
    // Expo now automatically handles variables prefixed with EXPO_PUBLIC_ from your .env file.
  },
};
