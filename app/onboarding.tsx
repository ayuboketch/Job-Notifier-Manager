// app/onboarding.tsx
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedGradientBackground from "../components/AnimatedGradientBackground";
import { useAuth } from "../context/AuthContext";

const { width, height } = Dimensions.get("window");
const slides = [
  {
    title: "Track Job Posts Instantly",
    description: "Monitor multiple company career pages in real time.",
    image: require("@/assets/onboarding/slide1.png"), // Ensure these paths are correct
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
  const carouselRef = useRef<ICarouselInstance>(null);
  const { updateOnboardingStatus } = useAuth();

  const handleGetStarted = async () => {
    // This function tells our AuthContext to update the user's status in Supabase.
    // The "gatekeeper" in _layout.tsx will see this change and automatically
    // navigate to the dashboard. We don't need to navigate here.
    await updateOnboardingStatus();
  };

  return (
    <View style={styles.container}>
      <AnimatedGradientBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.carouselContainer}>
            <Carousel
              ref={carouselRef}
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

          <View style={styles.paginationContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === currentIndex ? "#3B82F6" : "#64748B",
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.buttonContainer}>
            {currentIndex === slides.length - 1 ? (
              <TouchableOpacity
                style={styles.getStartedButton}
                onPress={handleGetStarted}
              >
                <Text style={styles.getStartedButtonText}>Get Started</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.navigationContainer}>
                {/* FIX: Call the carousel's next() method via its ref */}
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={() => carouselRef.current?.next()}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </AnimatedGradientBackground>
    </View>
  );
}

// Your full styles object here

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
