import { EventEmitter } from '../core/EventEmitter.js';

export class CommandManager extends EventEmitter {
  constructor(limit = 100) {
    super();
    this.limit = limit;
    this.stack = [];
    this.index = -1;
  }

  execute(command) {
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }
    this.stack.push(command);
    if (this.stack.length > this.limit) {
      this.stack.shift();
    } else {
      this.index += 1;
    }
    command.redo();
    this.emit('history:change', this.getState());
  }

  undo() {
    if (!this.canUndo()) return;
    const command = this.stack[this.index];
    command.undo();
    this.index -= 1;
    this.emit('history:change', this.getState());
  }

  redo() {
    if (!this.canRedo()) return;
    this.index += 1;
    const command = this.stack[this.index];
    command.redo();
    this.emit('history:change', this.getState());
  }

  canUndo() {
    return this.index >= 0;
  }

  canRedo() {
    return this.index < this.stack.length - 1;
  }

  getState() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      length: this.stack.length,
      index: this.index,
    };
  }
}
