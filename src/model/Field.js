import { generateId } from '../core/Id.js';

export class Field {
  constructor(spec = {}) {
    this.id = spec.id || generateId('field');
    this.name = spec.name || 'field';
    this.type = spec.type || 'text';
    this.isPrimaryKey = Boolean(spec.isPrimaryKey);
    this.isForeignKey = Boolean(spec.isForeignKey);
    this.isNullable = spec.isNullable !== undefined ? Boolean(spec.isNullable) : true;
    this.isUnique = Boolean(spec.isUnique);
    this.defaultValue = spec.defaultValue || null;
    this.comment = spec.comment || '';
    this.style = spec.style ? { ...spec.style } : null;
    this.metadata = spec.metadata ? { ...spec.metadata } : null;
  }

  update(partial) {
    Object.assign(this, partial);
  }

  clone() {
    return new Field(JSON.parse(JSON.stringify(this)));
  }
}
