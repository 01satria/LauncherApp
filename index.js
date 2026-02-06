// /**
//  * @format
//  */

// import {AppRegistry} from 'react-native';
// import App from './App';
// import {name as appName} from './app.json';

// AppRegistry.registerComponent(appName, () => App);

// index.js
import { AppRegistry } from 'react-native';
import App from './App'; // Atau path ke App.tsx
import RNAndroidNotificationListener, { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import { name as appName } from './app.json';

const headlessNotificationListener = async ({ notification }) => {
  if (notification) {
    // notification adalah JSON string, parse dulu
    const parsedNotification = JSON.parse(notification);
    const app = parsedNotification.app?.toLowerCase() || ''; // Ambil app name

    if (app) {
      // Simpan ke RNFS atau AsyncStorage untuk diakses di component
      // Contoh pakai RNFS (sesuaikan dengan kode kamu)
      const tempPath = `${RNFS.TemporaryDirectoryPath}/recent_notif.txt`;
      await RNFS.writeFile(tempPath, app, 'utf8');
      console.log('Notification saved from:', app);
    }
  }
};

// Register headless task
AppRegistry.registerHeadlessTask(
  RNAndroidNotificationListenerHeadlessJsName,
  () => headlessNotificationListener
);

AppRegistry.registerComponent(appName, () => App);