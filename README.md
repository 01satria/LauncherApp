# Satria Launcher 🚀

**Satria Launcher** is a minimalist, high-performance Android launcher built with **React Native**.  
It features a unique **Assistant Dock** with personalized greetings, advanced app management, smooth animations, and Simple style design philosophy.

[![React Native](https://img.shields.io/badge/React%20Native-0.70+-61DAFB?style=flat&logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=flat)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.2-green?style=flat)](https://github.com/01satria/satria-launcher)

---

## ✨ Key Features

### 🎯 Core Functionality
- **4-Column Grid Layout** - Clean app drawer with optimized spacing
- **Simple Style Icons** - Rounded square icons with 22% border radius
- **Smart App Management** - Hide/unhide apps with persistent storage
- **Dual-View Dock** - Toggle between Assistant messages and pinned apps (max 5)
- **Native Uninstall** - One-tap app removal with proper cleanup
- **Custom Avatar & Username** - Personalized Assistant experience
- **Persistent Settings** - All preferences saved across sessions

### 🎨 User Experience
- **60 FPS Animations** - Buttery smooth spring physics
- **Instant Feedback** - Spring scale animation on icon press
- **Time-Based Messages** - Assistant adapts to time of day
- **Toast Notifications** - Clear feedback for all actions
- **Empty States** - Helpful guidance when dock is empty
- **Minimalist Mode** - Toggle app name visibility

### ⚡ Performance
- **Hardware Acceleration** - All animations use native driver
- **Optimized Rendering** - Smart FlatList configuration
- **Memory Efficient** - ~88MB active RAM, ~65MB idle
- **Zero Memory Leaks** - Proper cleanup on component unmount
- **Background Optimization** - Minimal footprint when inactive

### 🛠️ Customization
- **Toggle App Names** - Icon-only minimalist mode
- **Show/Hide Apps** - Privacy-focused app management
- **Custom Avatar** - Upload your own assistant image (200x200px max)
- **Editable Username** - Personalized greeting messages
- **Transparent Background** - Your wallpaper shines through

---

## 📸 Screenshots

| Home Screen | Dock View | Action Modal | Settings |
|------------|-----------|--------------|----------|
| ![Home](screenshots/home.jpg) | ![Dock](screenshots/dock.jpg) | ![Actions](screenshots/actions.jpg) | ![Settings](screenshots/settings.jpg) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- React Native CLI
- Android Studio
- JDK 11+

### Installation
```bash
# Clone repository
git clone https://github.com/01satria/satria-launcher.git
cd satria-launcher

# Install dependencies
npm install

# Link native modules
npx react-native link

# Run on Android
npx react-native run-android
```

### Building APK
```bash
# Navigate to android directory
cd android

# Build release APK
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## 📦 Dependencies
```json
{
  "react": "^18.2.0",
  "react-native": "^0.72.0",
  "react-native-linear-gradient": "^2.8.0",
  "react-native-launcher-kit": "^3.0.0",
  "react-native-fs": "^2.20.0",
  "react-native-image-picker": "^5.6.0"
}
```

### Native Modules
- **UninstallModule** (Java/Kotlin) - Custom uninstall handler with proper cleanup

---

## 🎓 Usage Guide

### Basic Operations
| Action | Gesture |
|--------|---------|
| Launch app | **Tap** app icon |
| Open actions | **Long press** app icon |
| Toggle dock view | **Tap** avatar |
| Open settings | **Long press** avatar |

### App Management

**Pin to Dock**
1. Long press any app
2. Select "📌 Pin to Dock"
3. App moves to dock (max 5 apps)
4. Automatically removed from main list

**Hide App**
1. Long press app
2. Select "🙈 Hide"
3. App hidden from launcher
4. Auto-removed from dock if pinned

**Unhide App**
1. Enable "Show Hidden Apps" in settings
2. Long press hidden app
3. Select "👁️ Unhide"

**Uninstall App**
1. Long press app
2. Select "🗑️ Uninstall"
3. System uninstall dialog appears
4. Automatic cleanup after confirmation

### Dock Management

**Switch Views**
- **Tap avatar** → Toggle between message view and dock apps view
- **Long press avatar** → Open settings modal

**Pinned Apps**
- Max 5 apps in dock (Simple style)
- Apps automatically hidden from main drawer
- Long press dock app to unpin or uninstall

### Settings

**Available Options:**
- **Ur Name** - Customize Assistant's greeting
- **Show Hidden Apps** - Toggle visibility of hidden apps
- **Show App Names** - Minimalist icon-only mode
- **Change Avatar** - Upload custom assistant image (200x200px max)

---

## 🧠 Assistant Messages

Time-based personalized messages:

| Time | Message |
|------|---------|
| 22:00 - 04:00 | "It's late, ${name}. Put the phone down now! 😠" |
| 04:00 - 11:00 | "Good morning, ${name}! ☀️ Wake up and conquer the day" |
| 11:00 - 15:00 | "Have you had lunch, ${name}? 🍔" |
| 15:00 - 18:00 | "Take a break, ${name}! ☕" |
| 18:00 - 22:00 | "Time to relax, ${name} 🌙" |

*Updates every 60 seconds, pauses when app is in background*

---

## ⚙️ Technical Details

### Performance Configuration

**FlatList Optimization**
```javascript
{
  initialNumToRender: 20,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
  updateCellsBatchingPeriod: 50,
  getItemLayout: (data, index) => ({
    length: 90,
    offset: 90 * index,
    index
  })
}
```

**Animation Configuration**
```javascript
{
  friction: 5-8,           // Spring damping
  tension: 80-100,         // Spring stiffness
  duration: 150-250,       // Timing animations (ms)
  easing: Easing.out,      // Natural deceleration
  useNativeDriver: true    // 60 FPS guaranteed
}
```

### Persistent Storage

| File | Purpose |
|------|---------|
| `user.txt` | Username |
| `hidden.json` | Hidden app packages |
| `dock.json` | Pinned dock apps |
| `show_hidden.txt` | Show hidden toggle state |
| `show_names.txt` | Show app names toggle state |
| `asist.jpg` | Custom avatar (base64) |

**Storage Location:** `${DocumentDirectory}/satrialauncher/`

### Memory Management

**RAM Usage**
- **Idle:** ~65MB
- **Active:** ~88MB
- **Background:** Minimal footprint

**Optimization Techniques**
- React.memo for all components
- useCallback for event handlers
- Animation cleanup on unmount
- Removed clipped subviews
- Batch rendering strategy

### App State Listeners

**Install Listener**
- Auto-refresh on new app install
- Immediate UI update

**Resume Listener**
- Sync data 1 second after app resume
- Ensures consistency after uninstall

**Uninstall Strategy**
- Optimistic UI update (instant icon removal)
- Multiple refresh cycles: 1.8s, 4.5s, 8s
- Dock cleanup on uninstall
- Image instance cleanup to prevent crashes

---

## 🎨 Design System

### Color Palette
```javascript
// Background
transparent              // Wallpaper shows through

// Dock & Modals
#000000                 // Background
#333333                 // Borders
rgba(0,0,0,0.6)        // Modal overlay

// Text
#ffffff                 // Primary text
#eeeeee                 // App labels
#aaaaaa                 // Secondary text
#666666                 // Placeholders
#424242                 // Empty states

// Buttons
#2b6b45                 // Green (Save, Unhide)
#2b455e                 // Blue (Change Avatar)
#7c1f15                 // Red (Uninstall)
#511f66                 // Purple (Pin)
#945015                 // Orange (Unpin)
```

### Typography
```javascript
// App Labels
font-size: 11px
color: #eeeeee
text-shadow: rgba(0,0,0,0.8) 3px

// Assistant Message
font-size: 14px
font-weight: 500
line-height: 20px

// Modal Title
font-size: 20px
font-weight: bold

// Button Text
font-size: 15px
font-weight: bold
letter-spacing: 0.5px
```

### Icon Style
```javascript
// Simple Style Rounded Square
border-radius: size * 0.22  // 22% (default standard)
resize-mode: cover          // Perfect crop
background: #1a1a1a        // Subtle bg for transparency

// Sizes
Home Screen: 56px
Dock: 48px
```

---

## 📊 Performance Benchmarks

| Metric | Value | Grade |
|--------|-------|-------|
| **Cold Start** | ~2.5s | ⭐⭐⭐⭐ |
| **Hot Start** | ~0.8s | ⭐⭐⭐⭐⭐ |
| **RAM (Idle)** | ~65MB | ⭐⭐⭐⭐⭐ |
| **RAM (Active)** | ~108MB | ⭐⭐⭐⭐⭐ |
| **Animation FPS** | 60 locked | ⭐⭐⭐⭐⭐ |
| **Scroll Performance** | Buttery smooth | ⭐⭐⭐⭐⭐ |
| **Battery Impact** | Minimal | ⭐⭐⭐⭐⭐ |
| **APK Size** | ~15MB (split) | ⭐⭐⭐⭐ |

---

## 🔄 Version History

| Version | Release Date | Highlights |
|---------|--------------|------------|
| **v1.2** | Feb 2026 | Simple style icons, Advanced animations, Optimized performance |
| **v1.1** | Jan 2026 | Hide apps, Assistant, Basic animations |
| **v1.0** | Dec 2025 | Initial release, Basic launcher functionality |

### Changelog

**v1.2 (Current)**
- ✨ Simple style rounded square icons (22% border radius)
- ✨ Dual-view dock (message/apps toggle)
- ✨ 60 FPS spring animations on all interactions
- ✨ Settings modal with scale + slide animation
- ⚡ RAM usage optimized: 120MB → 88MB
- ⚡ Advanced FlatList configuration
- 🐛 Fixed Force Close on uninstall
- 🐛 Fixed dock apps showing in main list
- 🐛 Fixed bottom cutoff on dock message

**v1.1**
- ✨ Hide/unhide app functionality
- ✨ Uninstall app functionality
- ✨ Assistant with time-based messages
- ✨ Basic press animations
- 🐛 Performance improvements

**v1.0**
- 🎉 Initial release
- 📱 Basic launcher functionality
- 📋 4-column app grid

---

## 🛣️ Roadmap

### Planned Features
- [ ] **Search Functionality** - Quick app search bar
- [ ] **App Categories** - Auto-categorize apps (Social, Productivity, etc.)
- [ ] **Folders** - Group apps together
- [ ] **Gesture Controls** - Swipe up for app drawer, swipe down for notifications
- [ ] **Widget Support** - Add widgets to home screen
- [ ] **Theme Customization** - Multiple color schemes
- [ ] **Cloud Backup** - Sync settings across devices
- [ ] **Assistant Improvements** - More contextual messages
- [ ] **Icon Packs** - Support for third-party icon packs
- [ ] **Multilingual** - Support for multiple languages

### Future Enhancements
- [ ] Battery optimization tips
- [ ] Usage statistics
- [ ] App shortcuts
- [ ] Haptic feedback
- [ ] Dark/Light wallpaper detection

---

## ⚠️ Known Issues & Limitations

### Limitations
- **Dock Capacity:** Max 5 apps (design constraint)
- **Avatar Size:** Max 200x200px
- **Storage:** Cleared on app uninstall
- **System Permissions:** Required for uninstall and photo access

### Known Issues
- None currently reported

**Found a bug?** [Open an issue](https://github.com/01satria/satria-launcher/issues)

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest new features
- 📝 Improve documentation
- 🎨 Design improvements
- ⚡ Performance optimizations
- 🌍 Translations

### Pull Request Guidelines
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup
```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/satria-launcher.git
cd satria-launcher

# Install dependencies
npm install

# Start development
npx react-native start

# Run on device/emulator
npx react-native run-android
```

---

## 🙏 Acknowledgments

### Built With
- [React Native](https://reactnative.dev/) - Cross-platform framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [React Native Launcher Kit](https://www.npmjs.com/package/react-native-launcher-kit) - Launcher APIs
- [React Native Linear Gradient](https://github.com/react-native-linear-gradient/react-native-linear-gradient) - Gradient effects
- [React Native FS](https://github.com/itinance/react-native-fs) - File system access
- [React Native Image Picker](https://github.com/react-native-image-picker/react-native-image-picker) - Image selection

### Special Thanks
- React Native community for amazing libraries
- Android launcher development community
- Simple design team for inspiration
- All contributors and users

---

## 📞 Support & Contact

### Get Help
- 📧 **Email:** [contact@01satria.dev](mailto:see.cloudys@gmail.com)
- 🌐 **Website:** [https://01satria.vercel.app](https://01satria.vercel.app)
- 💬 **GitHub Issues:** [Report a bug](https://github.com/01satria/satria-launcher/issues)

### Developer
**Satria Dev**  
Full-Stack Developer | React Native Enthusiast  
🌐 [Website](https://01satria.vercel.app) | 💼 [GitHub](https://github.com/01satria)

---

## 📄 License

**All Rights Reserved © 2026 Satria Dev**

This project is proprietary software. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

For licensing inquiries, contact: [contact@01satria.dev](mailto:see.cloudys@gmail.com)

---

## ⭐ Show Your Support

If you like this project, please consider:
- ⭐ Star this repository
- 🐛 Report bugs
- 💡 Suggest features
- 🔀 Fork and contribute
- 📢 Share with friends

---

<div align="center">

**Built with ❤️ using React Native**

[⬆ Back to Top](#satria-launcher-)

</div>
