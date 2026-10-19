package dev.mtapi

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestPermsIfNeeded()

        val tok = Token.getOrCreate(this)
        val tv = TextView(this).apply {
            text = "token:\n$tok"
            setTextIsSelectable(true)
            textSize = 14f
        }
        val copyBtn = Button(this).apply {
            text = "Copy token"
            setOnClickListener {
                val cm = getSystemService(android.content.ClipboardManager::class.java)
                cm.setPrimaryClip(android.content.ClipData.newPlainText("mtapi", tok))
            }
        }
        val permBtn = Button(this).apply {
            text = "Re-check permissions"
            setOnClickListener { requestPermsIfNeeded() }
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 96, 48, 48)
            addView(tv)
            addView(copyBtn)
            addView(permBtn)
        }
        setContentView(root)
    }

    private fun requestPermsIfNeeded() {
        val perms = listOf(
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.CAMERA,
        )
        val missing = perms.filter {
            checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), REQ)
        }
    }

    companion object { const val REQ = 0x4d50 }
}
