export class ConnectManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.state = 'idle';
    this.preview = null;
    this.validate = options.validate || (() => true);
  }

  start(fromRef, pointer, emit) {
    this.state = 'connecting';
    this.preview = { from: fromRef, to: null, pointer };
    emit('interaction:connect:start', this.preview);
  }

  update(pointer, hitTarget, emit) {
    if (this.state !== 'connecting') return;
    this.preview.pointer = pointer;
    this.preview.to = hitTarget;
    emit('interaction:connect:preview', this.preview);
  }

  complete(toRef, emit) {
    if (this.state !== 'connecting') return null;
    const edgeSpec = { from: this.preview.from, to: toRef };
    if (!this.validate(this.preview.from, toRef)) {
      emit('interaction:connect:cancel', { reason: 'validate' });
      this.reset();
      return null;
    }
    emit('interaction:connect:complete', edgeSpec);
    this.reset();
    return edgeSpec;
  }

  cancel(emit) {
    if (this.state !== 'connecting') return;
    emit('interaction:connect:cancel', { reason: 'cancelled' });
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.preview = null;
  }
}
