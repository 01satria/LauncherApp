package com.satrialauncher; // <-- GANTI SESUAI FOLDERMU

import android.content.Intent;
import android.net.Uri;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class UninstallModule extends ReactContextBaseJavaModule {
    UninstallModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "UninstallModule";
    }

    @ReactMethod
    public void uninstallApp(String packageName) {
        try {
            Intent intent = new Intent(Intent.ACTION_DELETE);
            intent.setData(Uri.parse("package:" + packageName));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
        } catch (Exception e) {
            // ignore
        }
    }
}