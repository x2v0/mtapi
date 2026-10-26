---
title: "API endpoints"
weight: 20
bookToc: false
---

# 🔌 API endpoints

> Все — GET, JSON. Вызов: `fetch("/endpoint").then(r => r.json()).then(j => log(j))`

## Basic (16)

| Endpoint | Returns |
|---|---|
| `/ping` | pong |
| `/battery` | level, charging |
| `/wifi` | ssid, rssi |
| `/device` | model, sdk |
| `/location` | lat, lon |
| `/clipboard` | text |
| `/clipboard?op=set&text=hello` | set clipboard |
| `/toast?text=hello` | show toast |
| `/notify?title=Hi&body=There` | notification |
| `/vibrate?ms=200` | vibrate |
| `/torch?on=1` | flashlight on |
| `/torch?on=0` | off |
| `/torch/brightness?level=50` | set brightness |
| `/torch/brightness?level=0` | reset |
| `/tts?text=hello` | text-to-speech |
| `/share?title=Hi&text=There` | share intent |

## Contacts / SMS (3)

| Endpoint | Returns |
|---|---|
| `/contacts?limit=0` | contacts (0=all) |
| `/calllog?limit=0` | call log |
| `/sms?limit=0` | SMS |

## System (6)

| Endpoint | Returns |
|---|---|
| `/system` | device info |
| `/cpu/detail` | CPU cores |
| `/thermal` | temperatures |
| `/memory` | RAM |
| `/storage` | disks |
| `/kernel` | kernel version |

## Network (8)

| Endpoint | Returns |
|---|---|
| `/network` | connectivity |
| `/wifi/detailed` | WiFi detail |
| `/bluetooth` | BT state |
| `/telephony` | SIM/carrier |
| `/wifi/scan` | WiFi scan |
| `/net/ping?host=8.8.8.8&count=3` | ping |
| `/net/dns?host=example.com` | DNS |
| `/net/fetch?url=https%3A%2F%2Fapi.ipify.org%3Fformat%3Djson` | fetch URL |

## Display / Audio (7)

| Endpoint | Returns |
|---|---|
| `/display` | screen info |
| `/display/brightness` | brightness |
| `/display/color` | color mode |
| `/audio` | volume levels |
| `/microphone` | mic state |
| `/audio/volume?stream=2` | set volume |
| `/audio/ringer` | ringer mode |

## Sensors (4)

| Endpoint | Returns |
|---|---|
| `/sensors` | list |
| `/sensors/read?name=accelerometer&ms=200` | read |
| `/sensors/stream?name=accelerometer&hz=10` | stream |
| `/sensors/stream/stop?name=accelerometer` | stop |

## Hardware (4)

| Endpoint | Returns |
|---|---|
| `/features` | hw features |
| `/camera/list` | cameras |
| `/camera/snapshot` | snapshot |
| `/microphone/record?seconds=3` | record |

## Apps (2)

| Endpoint | Returns |
|---|---|
| `/app/list` | installed apps |
| `/app/launch?pkg=com.android.settings` | launch app |

## Detailed (5)

| Endpoint | Returns |
|---|---|
| `/battery/detailed` | battery detail |
| `/location/detailed` | location detail |
| `/locale` | locale |
| `/calendar?days=7` | calendar |
| `/alarm/next` | next alarm |

## Files / Audio play (5)

| Endpoint | Returns |
|---|---|
| `/files/save?name=test.txt&data=hello` | save file |
| `/audio/play?uri=/system/media/audio/notifications/Hello.ogg` | play |
| `/audio/play/stop` | stop |
| `/tts/voices` | TTS voices |
| `/tts/stop` | stop TTS |

## Watch (4)

| Endpoint | Returns |
|---|---|
| `/clipboard/watch?hz=2` | watch clipboard |
| `/clipboard/watch/stop` | stop |
| `/location/watch?hz=1` | watch location |
| `/location/watch/stop` | stop |
