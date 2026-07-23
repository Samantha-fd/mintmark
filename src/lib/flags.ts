/**
 * Video stamping is shelved (2026-07-23): the ffmpeg pipeline proved
 * unreliable across devices (hung hardware encoders, watchdog kills).
 * All video code is kept intact and compiling — this flag only closes the
 * single entry point (the home-screen picker). Flip to true to restore.
 */
export const VIDEO_STAMPING_ENABLED = false;
