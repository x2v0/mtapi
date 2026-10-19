package dev.mtapi;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.File;
import java.io.FileOutputStream;
import java.security.SecureRandom;

public final class Token {
    private static final String PREFS = "mtapi";
    private static final String KEY = "token";

    private Token() {}

    public static synchronized String getOrCreate(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String existing = sp.getString(KEY, null);
        if (existing != null) {
            writeToFile(ctx, existing);  // always write — Node dash reads this file
            return existing;
        }
        byte[] bytes = new byte[24];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b & 0xff));
        String tok = sb.toString();
        sp.edit().putString(KEY, tok).apply();
        writeToFile(ctx, tok);
        return tok;
    }

    private static void writeToFile(Context ctx, String tok) {
        try {
            File f = new File(ctx.getFilesDir(), "mtapi.token");
            FileOutputStream fos = new FileOutputStream(f, false);
            fos.write(tok.getBytes("UTF-8"));
            fos.close();
        } catch (Throwable ignored) {}
    }
}
