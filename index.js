// index.js
import {AppRegistry} from 'react-native';
import App from './App';  // ✅ File lama di root
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);