/**
 * Simple event emitter supporting on/off/once semantics.
 */
export class EventEmitter {
  constructor() {
    this._events = new Map();
  }

  on(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    const set = this._events.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this._events.delete(event);
    }
  }

  emit(event, ...args) {
    const set = this._events.get(event);
    if (!set) return;
    [...set].forEach((handler) => {
      try {
        handler(...args);
      } catch (err) {
        if (event !== 'error') {
          this.emit('error', { event, error: err });
        } else {
          console.error('Unhandled error in EventEmitter', err);
        }
      }
    });
  }
}
