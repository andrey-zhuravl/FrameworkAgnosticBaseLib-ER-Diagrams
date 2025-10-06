import { EventEmitter } from '../core/EventEmitter.js';

export class SelectionManager extends EventEmitter {
  constructor() {
    super();
    this.selection = {
      tables: [],
      edges: [],
      fields: [],
    };
  }

  getSelection() {
    return {
      tables: [...this.selection.tables],
      edges: [...this.selection.edges],
      fields: this.selection.fields.map((f) => ({ ...f })),
    };
  }

  setSelection(selection) {
    const normalized = {
      tables: Array.from(new Set(selection.tables || [])),
      edges: Array.from(new Set(selection.edges || [])),
      fields: (selection.fields || []).map((f) => ({ ...f })),
    };
    this.selection = normalized;
    this.emit('selection:change', this.getSelection());
  }

  clearSelection() {
    this.setSelection({ tables: [], edges: [], fields: [] });
  }

  toggleTable(id, multi = false) {
    if (!multi) {
      this.setSelection({ tables: [id], edges: [], fields: [] });
      return;
    }
    const set = new Set(this.selection.tables);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.selection.tables = [...set];
    this.emit('selection:change', this.getSelection());
  }
}
