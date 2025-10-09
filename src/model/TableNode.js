import { generateId } from '../core/Id.js';
import { Field } from './Field.js';

const DEFAULT_SIZE = { width: 200, height: 100 };

export class TableNode {
  constructor(spec = {}) {
    this.id = spec.id || generateId('table');
    this.name = spec.name || 'Table';
    this.position = {
      x: spec.position?.x ?? 0,
      y: spec.position?.y ?? 0,
    };
    const width = spec.size?.width ?? DEFAULT_SIZE.width;
    const height = spec.size?.height ?? DEFAULT_SIZE.height;
    this.size = { width, height };
    this.fields = (spec.fields || []).map((field) =>
      field instanceof Field ? field : new Field(field)
    );
    this.ports = spec.ports ? JSON.parse(JSON.stringify(spec.ports)) : null;
    this.style = spec.style ? { ...spec.style } : null;
    this.metadata = spec.metadata ? { ...spec.metadata } : null;
  }

  getField(fieldId) {
    return this.fields.find((field) => field.id === fieldId) || null;
  }

  addField(fieldSpec) {
    const field = fieldSpec instanceof Field ? fieldSpec : new Field(fieldSpec);
    this.fields.push(field);
    return field.id;
  }

  updateField(fieldId, partial) {
    const field = this.getField(fieldId);
    if (!field) return false;
    field.update(partial);
    return true;
  }

  removeField(fieldId) {
    const index = this.fields.findIndex((field) => field.id === fieldId);
    if (index === -1) return false;
    this.fields.splice(index, 1);
    return true;
  }

  reorderField(fieldId, newIndex) {
    const index = this.fields.findIndex((field) => field.id === fieldId);
    if (index === -1 || newIndex < 0 || newIndex >= this.fields.length) return false;
    const [field] = this.fields.splice(index, 1);
    this.fields.splice(newIndex, 0, field);
    return true;
  }

  update(partial) {
    if (partial.name !== undefined) this.name = partial.name;
    if (partial.position) {
      this.position = { ...this.position, ...partial.position };
    }
    if (partial.size) {
      this.size = { ...this.size, ...partial.size };
    }
    if (partial.style) {
      this.style = { ...(this.style || {}), ...partial.style };
    }
    if (partial.metadata) {
      this.metadata = { ...(this.metadata || {}), ...partial.metadata };
    }
    if (partial.fields) {
      this.fields = partial.fields.map((field) =>
        field instanceof Field ? field : new Field(field)
      );
    }
  }

  clone() {
    return new TableNode(JSON.parse(JSON.stringify(this)));
  }
}
