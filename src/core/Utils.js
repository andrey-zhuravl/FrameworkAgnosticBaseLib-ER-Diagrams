export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function throttle(fn, interval) {
  let lastTime = 0;
  let pending = null;
  return function throttled(...args) {
    const now = performance.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    } else {
      pending = args;
      if (!throttled._timeout) {
        throttled._timeout = setTimeout(() => {
          throttled._timeout = null;
          if (pending) {
            lastTime = performance.now();
            fn.apply(this, pending);
            pending = null;
          }
        }, interval - (now - lastTime));
      }
    }
  };
}

export function debounce(fn, wait) {
  let timeout = null;
  return function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function deepMerge(target, source) {
  if (!source) return target;
  const output = Array.isArray(target) ? target.slice() : { ...target };
  Object.keys(source).forEach((key) => {
    const srcVal = source[key];
    if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
      output[key] = deepMerge(output[key] || {}, srcVal);
    } else {
      output[key] = srcVal;
    }
  });
  return output;
}
