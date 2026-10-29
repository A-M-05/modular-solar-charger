import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PhoneFrame from './src/components/PhoneFrame';
import Home from './src/screens/Home';
import { color } from './src/theme';

export default function App() {
  const [loaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.ground }} />;
  return (
    <PhoneFrame>
      <SafeAreaProvider>
        <Home />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </PhoneFrame>
  );
}
