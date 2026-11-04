package com.tiprelaycompanion

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*
import com.tiprelaycompanion.storage.EventQueue
import com.tiprelaycompanion.storage.SecureSettings
import com.tiprelaycompanion.upload.UploadWorker
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class TipRelayModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val executor = Executors.newSingleThreadExecutor()
    override fun getName() = "TipRelay"
    @ReactMethod fun pair(baseUrl: String, code: String, promise: Promise) {
        executor.execute {
            try {
                val url = URL(baseUrl.trimEnd('/'))
                require(url.userInfo == null && url.query == null && url.ref == null)
                require(url.protocol == "https" || (BuildConfig.DEBUG && url.protocol == "http" && url.host == "127.0.0.1"))
                val connection = URL("${url}/v1/device/pair").openConnection() as HttpURLConnection
                try {
                    connection.instanceFollowRedirects = false
                    connection.requestMethod = "POST"
                    connection.connectTimeout = 15000
                    connection.readTimeout = 15000
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.outputStream.use { it.write(JSONObject().put("code", code).toString().toByteArray()) }
                    check(connection.responseCode == 200)
                    val token = connection.inputStream.bufferedReader().use { JSONObject(it.readText()).getString("token") }
                    EventQueue(context).use { it.clear() }
                    SecureSettings(context).save(url.toString(), token)
                    UploadWorker.schedule(context)
                    promise.resolve(null)
                } finally { connection.disconnect() }
            } catch (_: Exception) { promise.reject("PAIR_FAILED", "Pairing failed") }
        }
    }
    @ReactMethod fun diagnostics(promise: Promise) {
        try {
            val settings = SecureSettings(context)
            promise.resolve(Arguments.createMap().apply {
                putBoolean("paired", settings.token() != null)
                putBoolean("notificationAccess", NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName))
                putString("lastSync", settings.lastSync())
                putString("lastError", settings.error())
                putInt("pending", EventQueue(context).use { it.count() })
            })
        } catch (_: Exception) { promise.reject("DIAGNOSTICS_FAILED", "Diagnostics unavailable") }
    }
    @ReactMethod fun openNotificationSettings() { context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    @ReactMethod fun unpair(promise: Promise) { SecureSettings(context).clear();EventQueue(context).use { it.clear() };promise.resolve(null) }
}
