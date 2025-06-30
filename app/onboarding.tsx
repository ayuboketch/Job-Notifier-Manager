import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Carousel from "react-native-reanimated-carousel";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const slides = [
  {
    title: "Track Job Posts Instantly",
    description: "Monitor multiple company career pages in real time.",
    image: require("@/assets/onboarding/slide1.png"),
  },
  {
    title: "Beat the Rush",
    description:
      "Get notified the moment jobs are posted. First come, first served.",
    image: require("@/assets/onboarding/slide2.png"),
  },
  {
    title: "Save Jobs You Love",
    description: "Bookmark and track job posts you're interested in.",
    image: require("@/assets/onboarding/slide3.png"),
  },
  {
    title: "Never Miss an Opportunity",
    description: "Let the app monitor career pages for you 24/7.",
    image: require("@/assets/onboarding/slide4.png"),
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.carouselContainer}>
        <Carousel
          loop={false}
          width={width}
          height={height * 0.7}
          data={slides}
          scrollAnimationDuration={600}
          onSnapToItem={(index) => setCurrentIndex(index)}
          renderItem={({ item }) => (
            <View style={styles.slideContainer}>
              <View style={styles.imageContainer}>
                <Image
                  source={item.image}
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
              </View>
            </View>
          )}
        />
      </View>

      {/* Pagination dots */}
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex ? "#3B82F6" : "#64748B",
              },
            ]}
          />
        ))}
      </View>

      {/* Button section */}
      <View style={styles.buttonContainer}>
        {currentIndex === slides.length - 1 ? (
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => router.push("/(auth)/signup")}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.navigationContainer}>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => {
                if (currentIndex < slides.length - 1) {
                  setCurrentIndex(currentIndex + 1);
                }
              }}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => router.push("/(auth)/signup")}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141a1f",
  },
  carouselContainer: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    maxHeight: height * 0.4,
  },
  image: {
    width: width * 0.8,
    height: height * 0.35,
    borderRadius: 12,
  },
  textContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    alignItems: "center",
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    color: "#CBD5E1",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  getStartedButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  getStartedButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },
  navigationContainer: {
    alignItems: "center",
  },
  skipButton: {
    marginTop: 12,
  },
  skipButtonText: {
    color: "#64748B",
    fontWeight: "400",
    textAlign: "center",
    fontSize: 14,
  },
  nextButton: {
    backgroundColor: "#475569",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: "100%",
  },
  nextButtonText: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});
