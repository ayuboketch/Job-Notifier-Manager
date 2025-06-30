import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native'
import { useRouter } from 'expo-router'


export default function LandingScreen() {
    const router = useRouter()
  
    return (
      <View className="flex-1 justify-between bg-[#141a1f]">
        <View>
          <ImageBackground
            source={{
              uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDSg9QXpoRrhWYlGc20QnWnFfBYHvx-zYBXzYJaQAL4SqA1R58qpKM0-6ImnRUsj9wriEd-98hABD6eZ0fHaKFOmg2aS4nP1ixPfvGrk035WIEeSAxZ69mRymk-Y4BF2S2la38qkJoea4QgBJF45QtJWSaBQGdpAQcnLVdOQWVdoDy68syRN_X_OEcry1sgN4fye68ijN67Vs5j8oiPeDdhE4CgGR5MjnH3DBDmm01dfOHDzP6M3Zfm5PfKvWK6bmpsU2E_Ur9sFHs",
            }}
            className="w-full h-80 rounded-b-xl"
            resizeMode="cover"
          />
  
          <Text className="text-white text-[28px] font-bold text-center pt-6">
            Track your dream jobs
          </Text>
          <Text className="text-white text-base font-normal text-center px-4 pt-2">
            Get notified when new roles are posted on your favorite company career pages.
          </Text>
        </View>
  
        <View className="px-4 py-6">
          <TouchableOpacity
            className="h-12 bg-[#dce8f3] rounded-xl justify-center items-center"
            onPress={() => router.push("/(auth)/signup")}
          >
            <Text className="text-[#141a1f] font-bold text-base">Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0F172A',
  },
  image: {
    width: '80%', height: 240, marginBottom: 40,
  },
  title: {
    fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 10,
  },
  subtitle: {
    fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 40,
  },
  button: {
    backgroundColor: '#3B82F6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12,
  },
  buttonText: {
    color: 'white', fontSize: 16, fontWeight: '600',
  },
})
