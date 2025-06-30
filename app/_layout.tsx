import { Slot } from "expo-router"
import { TailwindProvider } from "nativewind"

export default function Layout() {
  return (
    <TailwindProvider>
      <Slot />
    </TailwindProvider>
  )
}
