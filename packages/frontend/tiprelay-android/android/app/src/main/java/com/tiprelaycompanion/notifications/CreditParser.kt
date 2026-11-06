package com.tiprelaycompanion.notifications

import java.math.BigDecimal
data class Credit(val amountPaise: Long, val transactionReference: String?, val payerName: String?)
object CreditParser {
    private val incoming = Regex("^(?:You have received|You received|Received) (?:₹|Rs\\.?|INR)\\s*([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?) from [^\\n]+(?:\\n(?:UPI Ref(?:erence)?(?: No)?|UTR):? ?([0-9]{12}))?\\.?$", RegexOption.IGNORE_CASE)
    private val denied = Regex("\\b(?:paid|sent|debited|request|requested|collect|refund|cashback|failed|pending)\\b", RegexOption.IGNORE_CASE)
    val supportedPackages = setOf("com.phonepe.app", "com.google.android.apps.nbu.paisa.user")
    private val googleIncoming = Regex("^[^\\n]+ paid you (?:₹|Rs\\.?|INR)\\s*([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)\\.?$", RegexOption.IGNORE_CASE)
    fun parse(packageName: String, text: String): Credit? {
        if (packageName !in supportedPackages || text.length > 1024) return null
        val match = if (packageName == "com.google.android.apps.nbu.paisa.user") {
            googleIncoming.matchEntire(text.trim())
        } else {
            if (denied.containsMatchIn(text)) return null
            incoming.matchEntire(text.trim())
        } ?: return null
        val paise = try { BigDecimal(match.groupValues[1].replace(",", "")).multiply(BigDecimal(100)).longValueExact() } catch (_: Exception) { return null }
        if (paise !in 100L..10000000L) return null
        val name = if (packageName == "com.google.android.apps.nbu.paisa.user") {
            text.substringBefore(" paid you ", "").trim()
        } else text.substringAfter(" from ", "").substringBefore('\n').trim().trimEnd('.')
        val safeName = name.filter { it.isLetterOrDigit() || it == ' ' || it == '-' || it == '\'' }.trim().take(80).ifEmpty { null }
        return Credit(paise, match.groupValues.getOrNull(2)?.ifEmpty { null }, safeName)
    }
}
