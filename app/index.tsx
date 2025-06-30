import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    // For now, let's redirect to onboarding
    const timer = setTimeout(() => {
      router.replace("/onboarding");
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 bg-[#141a1f] items-center justify-center">
      <Text className="text-white text-xl">Loading...</Text>
    </View>
  );
}
