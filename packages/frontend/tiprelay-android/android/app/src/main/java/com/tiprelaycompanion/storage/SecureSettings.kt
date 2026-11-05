package com.tiprelaycompanion.storage

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureSettings(context: Context, private val namespace: String = "tiprelay") {
    private val prefs = context.getSharedPreferences(namespace, Context.MODE_PRIVATE)
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("$namespace-device", null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("$namespace-device", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun token(): String? {
        val encoded = prefs.getString("credential", null) ?: return null
        return try {
            val data = Base64.decode(encoded, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, data.copyOfRange(0, 12)))
            String(cipher.doFinal(data.copyOfRange(12, data.size)), Charsets.UTF_8)
        } catch (_: Exception) { null }
    }
    fun save(url: String, token: String, creatorId: String = "") {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encoded = Base64.encodeToString(cipher.iv + cipher.doFinal(token.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
        check(prefs.edit().putString("creatorId", creatorId).putString("credential", encoded).putString("url", url).putString("lastError", "").commit())
    }
    fun creatorId(): String = prefs.getString("creatorId", "") ?: ""
    fun url(): String = prefs.getString("url", "") ?: ""
    fun lastSync(): String = prefs.getString("lastSync", "") ?: ""
    fun error(): String = prefs.getString("lastError", "") ?: ""
    fun synced() { prefs.edit().putString("lastSync", java.time.Instant.now().toString()).putString("lastError", "").apply() }
    fun error(value: String) { prefs.edit().putString("lastError", value).apply() }
    fun clear() { prefs.edit().clear().commit() }
}
