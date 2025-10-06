import { generateId } from '../core/Id.js';

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

export class Edge {
  constructor(spec = {}) {
    this.id = spec.id || generateId('edge');
    this.from = clone(spec.from || {});
    this.to = clone(spec.to || {});
    this.cardinality = clone(spec.cardinality || null);
    this.identifying = Boolean(spec.identifying);
    this.relationship = spec.relationship || 'custom';
    this.waypoints = spec.waypoints ? spec.waypoints.map((p) => ({ ...p })) : [];
    this.style = spec.style ? { ...spec.style } : null;
    this.label = spec.label || '';
    this.metadata = spec.metadata ? { ...spec.metadata } : null;
  }

  update(partial) {
    if (partial.from) this.from = { ...this.from, ...partial.from };
    if (partial.to) this.to = { ...this.to, ...partial.to };
    if (partial.cardinality) this.cardinality = { ...partial.cardinality };
    if (partial.identifying !== undefined) this.identifying = Boolean(partial.identifying);
    if (partial.relationship) this.relationship = partial.relationship;
    if (partial.waypoints) this.waypoints = partial.waypoints.map((p) => ({ ...p }));
    if (partial.style) this.style = { ...(this.style || {}), ...partial.style };
    if (partial.label !== undefined) this.label = partial.label;
    if (partial.metadata) this.metadata = { ...(this.metadata || {}), ...partial.metadata };
  }

  clone() {
    return new Edge(JSON.parse(JSON.stringify(this)));
  }
}
