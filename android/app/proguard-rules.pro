# ProGuard rules for React Native + Launcher Kit

# React Native core
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp *; }

# react-native-launcher-kit
-keep class com.reactnativelauncherkit.** { *; }
-keep class com.reactnativelauncherkit.RNLauncherKitHelper { *; }

# Optional: tambahan agar tidak ada warning berlebih
-dontwarn com.facebook.react.**
-dontwarn org.webkit.**
-dontwarn com.facebook.hermes.**