# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:
# Tambahkan rules dasar untuk React Native
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactProp *; }
# Tambah rules custom jika ada library lain, misal launcher-kit
-keep class com.reactnativelauncherkit.** { *; }  // Untuk library react-native-launcher-kit