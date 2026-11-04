package com.tiprelaycompanion.notifications

import java.math.BigDecimal
data class Credit(val amountPaise: Long, val transactionReference: String?)
object CreditParser {
    private val incoming = Regex("^(?:You have received|You received|Received) (?:₹|Rs\\.?|INR)\\s*([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?) from [^\\n]+(?:\\n(?:UPI Ref(?:erence)?(?: No)?|UTR):? ?([0-9]{12}))?\\.?$", RegexOption.IGNORE_CASE)
    private val denied = Regex("\\b(?:paid|sent|debited|request|requested|collect|refund|cashback|failed|pending)\\b", RegexOption.IGNORE_CASE)
    fun parse(packageName: String, text: String): Credit? {
        if (packageName != "com.phonepe.app" || text.length > 1024 || denied.containsMatchIn(text)) return null
        val match = incoming.matchEntire(text.trim()) ?: return null
        val paise = try { BigDecimal(match.groupValues[1].replace(",", "")).multiply(BigDecimal(100)).longValueExact() } catch (_: Exception) { return null }
        if (paise !in 100L..10000000L) return null
        return Credit(paise, match.groupValues[2].ifEmpty { null })
    }
}
