// index.js (root)
import {AppRegistry} from 'react-native';
import App from './src/App';  // ✅ Atau './src' juga bisa
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);