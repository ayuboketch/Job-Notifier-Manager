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
      backgroundColor: "#ffffff",
    },

    ios: {
      supportsTablet: true,
      statusBarStyle: "light",
    },

    android: {
      package: "com.anonymous.jobnotifiermanager",
      adaptiveIcon: {
        foregroundImage: "./assets/images/Job-Notifier-Manager.png",
        backgroundColor: "#ffffff",
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

    // FIX: The 'extra' block is removed.
    // Expo now automatically handles variables prefixed with EXPO_PUBLIC_ from your .env file.
  },
};
