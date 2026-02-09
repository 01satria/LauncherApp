package com.satrialauncher

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule

class LauncherPackageReceiver(private val reactContext: ReactApplicationContext) : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.action ?: return
        val packageName = intent.data?.schemeSpecificPart

        if (Intent.ACTION_PACKAGE_ADDED == action || Intent.ACTION_PACKAGE_REMOVED == action) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("PACKAGE_CHANGED", packageName)
        }
    }
}