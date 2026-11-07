import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'sk.slovakgo.app',
  appName: 'SlovakGO',
  webDir: 'dist-native',
  ios: {
    contentInset: 'never',
    backgroundColor: '#f4f4f2',
    preferredContentMode: 'mobile',
  },
  plugins: {
    // Native HTTP preserves HttpOnly sessions without weakening browser CORS.
    CapacitorHttp: { enabled: true },
    Keyboard: { resize: KeyboardResize.Native, autoBackdropColor: 'dom' },
    LocalNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
