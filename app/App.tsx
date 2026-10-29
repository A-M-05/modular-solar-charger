import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, useFonts } from '@expo-google-fonts/geist';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Home from './src/screens/Home';

export default function App() {
  const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
  if (!fontsLoaded) return null; // ponytail: blank until fonts load (a few ms); add expo-splash-screen if it ever flashes

  return (
    <SafeAreaProvider>
      <Home />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
