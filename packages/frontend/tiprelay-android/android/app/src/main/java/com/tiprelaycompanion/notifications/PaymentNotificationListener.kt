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
        if (sbn.packageName != "com.phonepe.app") return
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        if (SecureSettings(this).token() == null) return
        val extras = sbn.notification.extras
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: return
        val credit = CreditParser.parse(sbn.packageName, text) ?: return
        val identity = "${sbn.packageName}:${sbn.key}:${sbn.postTime}:${credit.amountPaise}:${credit.transactionReference ?: ""}"
        val eventId = UUID.nameUUIDFromBytes(identity.toByteArray()).toString()
        val event = JSONObject().put("eventId", eventId).put("sourceApp", sbn.packageName).put("amountPaise", credit.amountPaise).put("observedAt", Instant.ofEpochMilli(sbn.postTime).toString())
        credit.transactionReference?.let { event.put("transactionReference", it) }
        EventQueue(this).use { it.add(eventId, event.toString()) }
        UploadWorker.schedule(applicationContext)
    }
}
