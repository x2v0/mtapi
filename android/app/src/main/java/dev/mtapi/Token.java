package dev.mtapi;

import android.content.Context;
import android.content.SharedPreferences;

import java.security.SecureRandom;

public final class Token {
    private static final String PREFS = "mtapi";
    private static final String KEY = "token";

    private Token() {}

    public static synchronized String getOrCreate(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String existing = sp.getString(KEY, null);
        if (existing != null) return existing;
        byte[] bytes = new byte[24];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b & 0xff));
        String tok = sb.toString();
        sp.edit().putString(KEY, tok).apply();
        return tok;
    }
}
