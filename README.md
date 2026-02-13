# Satria Launcher 🚀

**Satria Launcher** is a minimalist, high-performance Android launcher built with **React Native**.  
It features a unique **Assistant Dock** that provides personalized greetings, advanced privacy through app hiding, and a clean, icon-free UI focused on typography and speed.



## 🌟 Key Features
- **Minimalist Interface** — Text-based initials instead of heavy icons for a clean, distraction-free aesthetic
- **Dynamic Assistant Dock** — Smart bottom bar with time-based greetings (Morning, Lunch, Afternoon, Evening, Night)
- **Privacy Control** — Long-press any app to hide it. Toggle visibility via secure settings
- **Personalized Experience** — Custom names for both user and assistant
- **Contextual Toasts** — Witty, fun reactions when opening specific apps (WhatsApp, Brave, YouTube, Camera, etc.)
- **Avatar Customization** — Change the assistant’s profile picture from your gallery
- **Persistent Storage** — All settings saved locally using `react-native-fs`



## 🛠️ Customization

### 1. Changing Names & Visibility
- **Long-press the Assistant Avatar** (bottom dock) for 1 second
- Settings modal appears with options to:
  - Edit **Assistant Name**
  - Edit **Your Name** (used in greetings)
  - Toggle **Show Hidden Apps**

### 2. Changing Assistant Photo
- Long-press avatar → Settings Modal
- Tap **"Change Photo"**
- Pick image from gallery → automatically saved as new avatar

### 3. Hiding / Unhiding Apps
- **Hide**: Long-press any app name → confirm
- **Unhide**: Enable "Show Hidden Apps" in settings → long-press hidden app → **Unhide**

### 4. Refreshing App List
- **Manual Refresh:** Simply press the **Back Button** on your device while on the homescreen to force a refresh instantly.
- **Auto-Sync:** When you install a new app or uninstall an old one, the list will automatically refresh after **5-7 seconds**. This delay is intentional to ensure system stability and prevent crashes.



## 🚀 Getting Started

### Prerequisites
- React Native development environment
- Physical Android device (strongly recommended)

### Installation

```bash
# 1. Install dependencies
npm install
# or
yarn install

# 2. Start Metro
npx react-native start

# 3. Run on Android
npx react-native run-android

```


## 📦 Technical Architecture

The project utilizes several key libraries and optimizations to interact with the Android System:

* **`react-native-launcher-kit`** → Fetch installed apps & launch applications.
* **`react-native-fs`** → Persistent storage for settings, names, and images.
* **`react-native-image-picker`** → Simple interface to select a custom avatar.
* **`React.memo` + `useCallback`** → Optimized rendering to ensure smooth **60fps** app list scrolling.



## 📝 Configuration Files

All local data is stored in the following directory:  
`${DocumentDirectoryPath}/satrialauncher/`

| File | Purpose |
| :--- | :--- |
| `name.txt` | Assistant's custom name |
| `user.txt` | User's name |
| `hidden.json` | Array of hidden package names |
| `asist.jpg` | Custom avatar image (Base64) |
| `show_hidden.txt` | Boolean flag (`true`/`false`) for hidden apps visibility |



## 🚀 Getting Started

1.  **Install Dependencies**: `npm install`
2.  **Start Metro**: `npx react-native start`
3.  **Run on Android**: `npx react-native run-android`



## 🤝 Contributing

Feel free to fork this project and make it your own!  
Pull requests for:
* New features
* Better witty toasts
* Performance improvements
* AI Agent Intergrated

...are very welcome!

---

Built with ❤️ using **React Native** by @01satria


