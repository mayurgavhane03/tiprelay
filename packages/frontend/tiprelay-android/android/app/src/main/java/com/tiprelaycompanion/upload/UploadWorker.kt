package com.tiprelaycompanion.upload

import android.content.Context
import androidx.work.*
import com.tiprelaycompanion.storage.EventQueue
import com.tiprelaycompanion.storage.SecureSettings
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class UploadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val settings = SecureSettings(applicationContext)
        val token = settings.token() ?: return Result.success()
        EventQueue(applicationContext).use { queue ->
            queue.cleanup()
            for ((id, payload) in queue.pending()) {
                try {
                    val connection = URL(settings.url() + "/v1/device/payment-observations").openConnection() as HttpURLConnection
                    try {
                        connection.instanceFollowRedirects = false
                        connection.requestMethod = "POST"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 15000
                        connection.doOutput = true
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                        when (connection.responseCode) {
                            in 200..299 -> { queue.complete(id); settings.synced() }
                            401, 403, 404 -> { settings.error("Pairing revoked or creator unavailable. Pair again."); return Result.failure() }
                            400, 409, 422 -> { queue.complete(id); settings.error("An observation was rejected. Check dashboard.") }
                            else -> { settings.error("Upload delayed. Retrying automatically."); return Result.retry() }
                        }
                    } finally { connection.disconnect() }
                } catch (_: Exception) { settings.error("Offline or API unreachable. Retrying automatically.");return Result.retry() }
            }
            if (queue.count() > 0) return Result.retry()
        }
        return Result.success()
    }
    companion object {
        fun schedule(context: Context) {
            val request = OneTimeWorkRequestBuilder<UploadWorker>().setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS).build()
            WorkManager.getInstance(context).enqueueUniqueWork("tiprelay-upload", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }
    }
}
