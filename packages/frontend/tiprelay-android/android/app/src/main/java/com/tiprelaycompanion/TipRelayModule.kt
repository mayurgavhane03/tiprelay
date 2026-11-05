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
    override fun getConstants(): MutableMap<String, Any> = mutableMapOf(
        "deployment" to mapOf(
            "apiUrl" to BuildConfig.API_URL,
            "cognitoDomain" to BuildConfig.COGNITO_DOMAIN,
            "mobileClientId" to BuildConfig.MOBILE_CLIENT_ID,
            "webUrl" to BuildConfig.WEB_URL
        )
    )
    @ReactMethod fun pair(baseUrl: String, code: String, accessToken: String, promise: Promise) {
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
                    connection.setRequestProperty("Authorization", "Bearer $accessToken")
                    connection.outputStream.use { it.write(JSONObject().put("code", code).toString().toByteArray()) }
                    check(connection.responseCode == 200)
                    val result = connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
                    EventQueue(context).use { it.clear() }
                    SecureSettings(context).save(url.toString(), result.getString("token"), result.getString("creatorId"))
                    UploadWorker.schedule(context)
                    promise.resolve(null)
                } finally { connection.disconnect() }
            } catch (_: Exception) { promise.reject("PAIR_FAILED", "Pairing failed") }
        }
    }
    @ReactMethod fun saveSession(token: String, promise: Promise) {
        try { SecureSettings(context, "tiprelay-session").save("", token); promise.resolve(null) }
        catch (_: Exception) { promise.reject("SESSION_FAILED", "Unable to save session") }
    }
    @ReactMethod fun readSession(promise: Promise) {
        try { promise.resolve(SecureSettings(context, "tiprelay-session").token()) }
        catch (_: Exception) { promise.reject("SESSION_FAILED", "Unable to read session") }
    }
    @ReactMethod fun clearSession(promise: Promise) {
        try { SecureSettings(context, "tiprelay-session").clear(); promise.resolve(null) }
        catch (_: Exception) { promise.reject("SESSION_FAILED", "Unable to clear session") }
    }
    @ReactMethod fun diagnostics(promise: Promise) {
        try {
            val settings = SecureSettings(context)
            promise.resolve(Arguments.createMap().apply {
                putString("creatorId", settings.creatorId())
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
