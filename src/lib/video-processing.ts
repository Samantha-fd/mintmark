import {
  FFmpegKit,
  ReturnCode,
  type FFmpegSession,
} from '@wokcito/ffmpeg-kit-react-native';
import { File, Paths } from 'expo-file-system';
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

/** cap the longer side at 1920 (only ever downscales) */
function outputDims(width: number, height: number): { w: number; h: number } {
  const longer = Math.max(width, height);
  if (longer <= 1920) return { w: width, h: height };
  const f = 1920 / longer;
  return {
    w: Math.round((width * f) / 2) * 2,
    h: Math.round((height * f) / 2) * 2,
  };
}

/** rough h264 bitrate in Mbit/s from output resolution */
function bitrateFor(w: number, h: number): number {
  return Math.min(20, Math.max(2, Math.round((w * h) / 300000)));
}

/** kill an attempt that makes no progress for this long (hung encoder) */
const STALL_MS = 20000;

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
 * encoder first; a watchdog kills silently-hung attempts and falls back to
 * FFmpeg's built-in software encoder. Audio is passed through untouched.
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

  let cancelledByUser = false;
  let current: FFmpegSession | null = null;
  const logTail: string[] = [];

  const { w, h } = outputDims(opts.width, opts.height);
  const scaleClause =
    w !== opts.width || h !== opts.height ? `,scale=${w}:${h}` : '';
  const filter =
    `[1:v][0:v]scale2ref[ov][base];` +
    `[base][ov]overlay=0:0:format=auto${scaleClause},format=nv12[vout]`;

  const command = (videoCodec: string) =>
    `-y -i "${plainPath(opts.videoUri)}" -i "${plainPath(overlay.uri)}" ` +
    `-filter_complex "${filter}" -map "[vout]" -map 0:a? ` +
    `${videoCodec} -c:a copy -movflags +faststart "${plainPath(out.uri)}"`;

  /** resolves true on success, false on failure/stall (→ try fallback) */
  const run = (videoCodec: string) =>
    new Promise<boolean>((resolve, reject) => {
      let lastAdvance = Date.now();
      let lastTime = 0;
      let killedByWatchdog = false;
      const watchdog = setInterval(() => {
        if (Date.now() - lastAdvance > STALL_MS) {
          killedByWatchdog = true;
          clearInterval(watchdog);
          current?.cancel();
        }
      }, 3000);

      FFmpegKit.executeAsync(
        command(videoCodec),
        async (session) => {
          clearInterval(watchdog);
          const rc = await session.getReturnCode();
          if (ReturnCode.isSuccess(rc)) resolve(true);
          else if (ReturnCode.isCancel(rc) && cancelledByUser)
            reject(new Error('cancelled'));
          else resolve(false); // failed or watchdog-killed → fallback
          void killedByWatchdog;
        },
        (log) => {
          logTail.push(String(log.getMessage()));
          if (logTail.length > 8) logTail.shift();
        },
        (stats) => {
          const t = stats.getTime();
          if (t > lastTime) {
            lastTime = t;
            lastAdvance = Date.now();
          }
          if (opts.onProgress && opts.durationMs > 0 && t > 0) {
            opts.onProgress(Math.min(1, t / opts.durationMs));
          }
        },
      )
        .then((session) => {
          current = session;
          if (cancelledByUser) session.cancel();
        })
        .catch((e) => {
          clearInterval(watchdog);
          reject(e);
        });
    });

  const promise = (async () => {
    try {
      const hw = `-c:v h264_mediacodec -b:v ${bitrateFor(w, h)}M`;
      let ok = await run(hw);
      if (!ok && !cancelledByUser) {
        // software fallback: built-in encoder, works everywhere
        ok = await run('-c:v mpeg4 -q:v 4');
      }
      if (!ok) {
        const detail = logTail.join(' ').trim().slice(-160);
        throw new Error(
          `Could not process this video on this device.${detail ? ` (${detail})` : ''}`,
        );
      }
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
      cancelledByUser = true;
      current?.cancel();
    },
  };
}
