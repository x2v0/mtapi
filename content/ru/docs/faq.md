---
title: "FAQ"
weight: 5
---

# FAQ

**iframe не грузит google.com?**

X-Frame-Options. Используй /proxy-url?url=...

**logcat пустой?**

Android 11+ SELinux ограничивает logcat для untrusted_app. Нужен adb или root.
