import {AppRegistry} from 'react-native';
import App from './src/App';  // ✅ Import langsung dari App.tsx
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);