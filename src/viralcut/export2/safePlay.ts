export function safePlay(el: HTMLVideoElement, timeoutMs = 800): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);

    try {
      const result = el.play();

      if (result && typeof result.then === 'function') {
        result.then(() => {
          clearTimeout(timer);
          finish();
        }).catch(() => {
          clearTimeout(timer);
          finish();
        });
      } else {
        clearTimeout(timer);
        finish();
      }
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}
