export default {
  expo: {
    name: "Job Notifier Manager",
    slug: "job-notifier-manager",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "jobnotifiermanager",
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

    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  },
};
