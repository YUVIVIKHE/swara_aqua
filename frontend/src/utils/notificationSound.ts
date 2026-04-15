// Generates a short notification "ding" using the Web Audio API
// No external file needed — works on all modern browsers
export const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Ding 1 — higher note
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.type = 'sine';
    o1.frequency.setValueAtTime(880, ctx.currentTime);
    o1.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    g1.gain.setValueAtTime(0.4, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o1.start(ctx.currentTime);
    o1.stop(ctx.currentTime + 0.4);

    // Ding 2 — lower note slightly delayed
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = 'sine';
    o2.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    o2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    g2.gain.setValueAtTime(0.3, ctx.currentTime + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o2.start(ctx.currentTime + 0.1);
    o2.stop(ctx.currentTime + 0.5);

    // Auto-close context after sound finishes
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Silently fail if audio not supported
  }
};
