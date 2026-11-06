package com.tiprelaycompanion.notifications
import org.junit.Assert.*
import org.junit.Test

class CreditParserTest {
    @Test fun googlePayTitle() {
        val app = "com.google.android.apps.nbu.paisa.user"
        assertEquals(10000L, CreditParser.parse(app, "Example Supporter paid you ₹100")?.amountPaise)
        assertEquals("Example Supporter", CreditParser.parse(app, "Example Supporter paid you ₹100")?.payerName)
        assertEquals(10050L, CreditParser.parse(app, "Example Supporter paid you ₹100.50")?.amountPaise)
        for (text in listOf("You paid Example ₹100", "Example requested ₹100", "Payment from PhonePe", "Example paid you ₹…", "Example paid you ₹100 pending")) assertNull(CreditParser.parse(app, text))
        assertNull(CreditParser.parse("com.example.other", "Example paid you ₹100"))
    }
    @Test fun incomingSyntheticCredit() {
        val credit = CreditParser.parse("com.phonepe.app", "You received ₹100.50 from Example Supporter\nUPI Ref: 123456789012")
        assertEquals(10050L, credit?.amountPaise)
        assertEquals("123456789012", credit?.transactionReference)
    }
    @Test fun ignoreOutgoingAndRequests() {
        for (text in listOf("You paid ₹100 to Example", "Example requested ₹100", "₹100 debited", "Cashback received ₹100", "You received ₹100 from Example pending")) assertNull(CreditParser.parse("com.phonepe.app", text))
    }
    @Test fun ignoreOtherAppsAndMalformedAmounts() {
        assertNull(CreditParser.parse("com.example.other", "Received ₹100 from Example"))
        assertNull(CreditParser.parse("com.phonepe.app", "Received ₹0.001 from Example"))
        assertNull(CreditParser.parse("com.phonepe.app", "Received ₹1000000000 from Example"))
    }
    @Test fun referenceIsOptionalAndEqualAmountsArePreserved() {
        assertEquals(10000L, CreditParser.parse("com.phonepe.app", "Received INR 100 from Example")?.amountPaise)
        assertNotEquals(CreditParser.parse("com.phonepe.app", "Received ₹100 from Example\nUTR: 123456789012")?.transactionReference, CreditParser.parse("com.phonepe.app", "Received ₹100 from Example\nUTR: 123456789013")?.transactionReference)
    }
}
