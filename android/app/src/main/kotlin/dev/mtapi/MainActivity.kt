package dev.mtapi

import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val tok = Token.getOrCreate(this)
        val tv = TextView(this).apply {
            text = "token:\n$tok"
            setTextIsSelectable(true)
            textSize = 14f
        }
        val btn = Button(this).apply {
            text = "Copy"
            setOnClickListener {
                val cm = getSystemService(android.content.ClipboardManager::class.java)
                cm.setPrimaryClip(android.content.ClipData.newPlainText("mtapi", tok))
            }
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 96, 48, 48)
            addView(tv)
            addView(btn)
        }
        setContentView(root)
    }
}
