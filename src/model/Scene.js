import { TableNode } from './TableNode.js';
import { Edge } from './Edge.js';

export class Scene {
  constructor() {
    this.tables = new Map();
    this.edges = new Map();
  }

  addTable(tableSpec) {
    const table = tableSpec instanceof TableNode ? tableSpec : new TableNode(tableSpec);
    this.tables.set(table.id, table);
    return table.id;
  }

  updateTable(id, partial) {
    const table = this.tables.get(id);
    if (!table) return false;
    table.update(partial);
    return true;
  }

  removeTable(id) {
    const existed = this.tables.delete(id);
    if (existed) {
      [...this.edges.values()].forEach((edge) => {
        if (edge.from.tableId === id || edge.to.tableId === id) {
          this.edges.delete(edge.id);
        }
      });
    }
    return existed;
  }

  getTable(id) {
    return this.tables.get(id) || null;
  }

  addEdge(edgeSpec) {
    const edge = edgeSpec instanceof Edge ? edgeSpec : new Edge(edgeSpec);
    this.edges.set(edge.id, edge);
    return edge.id;
  }

  updateEdge(id, partial) {
    const edge = this.edges.get(id);
    if (!edge) return false;
    edge.update(partial);
    return true;
  }

  removeEdge(id) {
    return this.edges.delete(id);
  }

  getEdge(id) {
    return this.edges.get(id) || null;
  }

  toJSON() {
    return {
      tables: [...this.tables.values()].map((table) => ({
        id: table.id,
        name: table.name,
        position: { ...table.position },
        size: { ...table.size },
        fields: table.fields.map((field) => ({
          id: field.id,
          name: field.name,
          type: field.type,
          isPrimaryKey: field.isPrimaryKey,
          isForeignKey: field.isForeignKey,
          isNullable: field.isNullable,
          isUnique: field.isUnique,
          defaultValue: field.defaultValue,
          comment: field.comment,
          style: field.style ? { ...field.style } : undefined,
          metadata: field.metadata ? { ...field.metadata } : undefined,
        })),
        style: table.style ? { ...table.style } : undefined,
        metadata: table.metadata ? { ...table.metadata } : undefined,
      })),
      edges: [...this.edges.values()].map((edge) => ({
        id: edge.id,
        from: { ...edge.from },
        to: { ...edge.to },
        cardinality: edge.cardinality ? { ...edge.cardinality } : undefined,
        identifying: edge.identifying,
        relationship: edge.relationship,
        waypoints: edge.waypoints.map((wp) => ({ ...wp })),
        style: edge.style ? { ...edge.style } : undefined,
        label: edge.label,
        metadata: edge.metadata ? { ...edge.metadata } : undefined,
      })),
    };
  }

  fromJSON(json) {
    this.tables.clear();
    this.edges.clear();
    (json.tables || []).forEach((table) => this.addTable(table));
    (json.edges || []).forEach((edge) => this.addEdge(edge));
  }
}
