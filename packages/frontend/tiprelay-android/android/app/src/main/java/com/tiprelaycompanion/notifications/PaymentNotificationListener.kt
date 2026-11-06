package com.tiprelaycompanion.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.tiprelaycompanion.storage.EventQueue
import com.tiprelaycompanion.storage.SecureSettings
import com.tiprelaycompanion.upload.UploadWorker
import java.time.Instant
import java.util.UUID
import org.json.JSONObject

class PaymentNotificationListener : NotificationListenerService() {
    override fun onListenerConnected() { UploadWorker.schedule(applicationContext) }
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in CreditParser.supportedPackages) return
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        if (SecureSettings(this).token() == null) return
        val extras = sbn.notification.extras
        val candidates = if (sbn.packageName == "com.google.android.apps.nbu.paisa.user") {
            listOf(Notification.EXTRA_TITLE, Notification.EXTRA_BIG_TEXT, Notification.EXTRA_TEXT)
        } else listOf(Notification.EXTRA_BIG_TEXT, Notification.EXTRA_TEXT)
        val credit = candidates.mapNotNull { key ->
            extras.getCharSequence(key)?.toString()?.let { CreditParser.parse(sbn.packageName, it) }
        }.firstOrNull() ?: return
        val identity = "${sbn.packageName}:${sbn.key}:${sbn.postTime}:${credit.amountPaise}:${credit.transactionReference ?: ""}"
        val eventId = UUID.nameUUIDFromBytes(identity.toByteArray()).toString()
        val event = JSONObject().put("eventId", eventId).put("sourceApp", sbn.packageName).put("amountPaise", credit.amountPaise).put("observedAt", Instant.ofEpochMilli(sbn.postTime).toString())
        credit.transactionReference?.let { event.put("transactionReference", it) }
        credit.payerName?.let { event.put("payerName", it) }
        EventQueue(this).use { it.add(eventId, event.toString()) }
        UploadWorker.schedule(applicationContext)
    }
}
