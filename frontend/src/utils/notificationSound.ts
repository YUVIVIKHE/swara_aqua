// Generates a loud notification "ding" using the Web Audio API
export const playNotificationSound = async () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Resume context if suspended (required by browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const play = (freq: number, startTime: number, duration: number, volume: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      // Compressor to maximize loudness
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.knee.value      = 0;
      comp.ratio.value     = 20;
      comp.attack.value    = 0;
      comp.release.value   = 0.1;

      osc.connect(gain);
      gain.connect(comp);
      comp.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, ctx.currentTime + startTime + duration);

      // Full volume attack, slow decay
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Three-tone chime at max volume (1.0)
    play(1046, 0.00, 0.35, 1.0); // C6
    play(1318, 0.15, 0.35, 1.0); // E6
    play(1568, 0.30, 0.50, 1.0); // G6

    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Silently fail if audio not supported
  }
};
