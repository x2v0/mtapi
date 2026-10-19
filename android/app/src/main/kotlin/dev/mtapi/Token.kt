package dev.mtapi

import android.content.Context
import java.security.SecureRandom

object Token {
    private const val PREFS = "mtapi"
    private const val KEY = "token"

    fun getOrCreate(ctx: Context): String {
        val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sp.getString(KEY, null)?.let { return it }
        val bytes = ByteArray(24)
        SecureRandom().nextBytes(bytes)
        val tok = bytes.joinToString("") { "%02x".format(it) }
        sp.edit().putString(KEY, tok).apply()
        return tok
    }
}
