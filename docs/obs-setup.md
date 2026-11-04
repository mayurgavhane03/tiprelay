# OBS setup

1. Start TipRelay and open **Stream setup** in the dashboard. Create an overlay URL and copy it immediately. It is shown once and includes a private fragment secret.
2. In OBS, add a **Browser Source**, name it TipRelay, paste the URL, and set a suitable canvas such as 800 × 600. The page has a transparent background.
3. Enable **Control audio via OBS**. Keep **Shutdown source when not visible** and **Refresh browser when scene becomes active** disabled for a persistent source.
4. In the mixer, unmute the source and confirm the recording/stream track in Advanced Audio Properties. Enable monitoring only if you also need to hear it locally. Avoid routing monitoring back into desktop capture and doubling the audio.
5. Start a local recording, press **Test alert**, wait for the amount card and chime, then stop and replay the recording. Mixer movement alone does not prove that the recording includes the correct track.
6. Submit and approve a matched test message with Piper running, and repeat the recording. Confirm chime and speech are audible. Speech can arrive separately after the amount alert.

The Browser Source uses the actual backend WebSocket, including Test Alert. It needs no OBS control plugin. Playback uses separate bounded queues for chimes and speech. OBS reconnects with exponential backoff and jitter. Expired events never play, and alert IDs persist across source refreshes while unexpired.

Ordinary browser previews may require a user gesture for autoplay. A blocked-playback message appears on the overlay. Confirm behavior in the installed OBS version as the release authority.

OBS supports Browser Sources with HTML media and exposes source refresh/shutdown controls. See [OBS Browser Source documentation](https://obsproject.com/kb/browser-source) and [OBS browser audio controls](https://obsproject.com/blog/progress-report-september-2019).
