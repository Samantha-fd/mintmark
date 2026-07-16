import { File, Paths } from 'expo-file-system';
import {
  FFmpegKit,
  ReturnCode,
  type FFmpegSession,
} from '@wokcito/ffmpeg-kit-react-native';
import { NativeModules } from 'react-native';

/**
 * FFmpeg is native code baked into the installed app — it does not exist
 * inside Expo Go, where the native module resolves to null.
 */
export function isVideoStampingAvailable(): boolean {
  return NativeModules.FFmpegKitReactNativeModule != null;
}

/** ffmpeg wants plain filesystem paths, not file:// URIs */
function plainPath(uri: string): string {
  return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

export type StampVideoOptions = {
  videoUri: string;
  /** transparent PNG at the video's resolution (scale2ref corrects drift) */
  overlayPngBytes: Uint8Array;
  width: number;
  height: number;
  /** for progress reporting; 0 disables progress */
  durationMs: number;
  onProgress?: (fraction: number) => void;
};

export type StampVideoHandle = {
  /** resolves with the file:// URI of the stamped mp4 in the cache dir */
  promise: Promise<string>;
  cancel: () => void;
};

/**
 * Burns the overlay into the video. Tries the device's hardware h264
 * encoder first (fast, LGPL-clean); falls back to FFmpeg's built-in mpeg4
 * encoder on devices where MediaCodec misbehaves. Audio is passed through
 * untouched.
 */
export function stampVideo(opts: StampVideoOptions): StampVideoHandle {
  if (!isVideoStampingAvailable()) {
    return {
      promise: Promise.reject(
        new Error(
          'Video stamping needs the installed Markly app — the Expo Go preview cannot process video.',
        ),
      ),
      cancel: () => {},
    };
  }
  const overlay = new File(Paths.cache, `overlay-${Date.now()}.png`);
  overlay.write(opts.overlayPngBytes);
  const out = new File(Paths.cache, `stamped-${Date.now()}.mp4`);

  let cancelled = false;
  let current: FFmpegSession | null = null;

  const filter =
    '[1:v][0:v]scale2ref[ov][base];[base][ov]overlay=0:0:format=auto,format=nv12[vout]';

  const command = (videoCodec: string) =>
    `-y -i "${plainPath(opts.videoUri)}" -i "${plainPath(overlay.uri)}" ` +
    `-filter_complex "${filter}" -map "[vout]" -map 0:a? ` +
    `${videoCodec} -c:a copy -movflags +faststart "${plainPath(out.uri)}"`;

  /** resolves true on success, false on failure (→ try fallback) */
  const run = (videoCodec: string) =>
    new Promise<boolean>((resolve, reject) => {
      FFmpegKit.executeAsync(
        command(videoCodec),
        async (session) => {
          const rc = await session.getReturnCode();
          if (ReturnCode.isSuccess(rc)) resolve(true);
          else if (ReturnCode.isCancel(rc)) reject(new Error('cancelled'));
          else resolve(false);
        },
        undefined,
        (stats) => {
          const t = stats.getTime();
          if (opts.onProgress && opts.durationMs > 0 && t > 0) {
            opts.onProgress(Math.min(1, t / opts.durationMs));
          }
        },
      )
        .then((session) => {
          current = session;
          if (cancelled) session.cancel();
        })
        .catch(reject);
    });

  const promise = (async () => {
    try {
      const hw = `-c:v h264_mediacodec -b:v ${bitrateFor(opts)}M`;
      let ok = await run(hw);
      if (!ok && !cancelled) {
        // software fallback: built-in encoder, works everywhere
        ok = await run('-c:v mpeg4 -q:v 4');
      }
      if (!ok) throw new Error('Could not process this video on this device.');
      return out.uri;
    } finally {
      try {
        overlay.delete();
      } catch {
        // leftover cache file is harmless
      }
    }
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      current?.cancel();
    },
  };
}

/** rough h264 bitrate in Mbit/s from resolution, clamped to sane bounds */
function bitrateFor(opts: StampVideoOptions): number {
  return Math.min(20, Math.max(2, Math.round((opts.width * opts.height) / 300000)));
}
