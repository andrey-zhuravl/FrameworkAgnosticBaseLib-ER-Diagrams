(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.ERCanvasLib = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  class EventEmitter {
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

  let idCounter = 0;
  function generateId(prefix = 'id') {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function deepMerge(target, source) {
    if (!source) return Array.isArray(target) ? target.slice() : { ...target };
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

  function rectContains(rect, x, y) {
    return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
  }

  const DEFAULT_THEME = {
    colors: {
      background: '#1e1e1e',
      grid: 'rgba(255,255,255,0.05)',
      tableHeader: '#2d2d30',
      tableBody: '#252526',
      border: '#3f3f46',
      text: '#f5f5f5',
      edge: '#a0a0b0',
      selection: '#3a96dd',
    },
    fonts: {
      base: '12px Inter, Roboto, sans-serif',
      header: 'bold 13px Inter, Roboto, sans-serif',
      field: '12px Inter, Roboto, sans-serif',
    },
    sizes: {
      grid: 32,
      tablePadding: 12,
      rowHeight: 22,
      borderWidth: 1,
      edgeWidth: 2,
      cornerRadius: 8,
    },
  };

  class Field {
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
  }

  class TableNode {
    constructor(spec = {}) {
      this.id = spec.id || generateId('table');
      this.name = spec.name || 'Table';
      this.position = {
        x: spec.position?.x ?? 0,
        y: spec.position?.y ?? 0,
      };
      const width = spec.size?.width ?? 200;
      const height = spec.size?.height ?? 120;
      this.size = { width, height };
      this.fields = (spec.fields || []).map((field) => (field instanceof Field ? field : new Field(field)));
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
        this.fields = partial.fields.map((field) => (field instanceof Field ? field : new Field(field)));
      }
    }
  }

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  class Edge {
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
  }

  class Scene {
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

  class GridLayer {
    constructor(options) {
      this.options = options;
    }
    draw(ctx, camera, theme, canvasSize) {
      const { enabled, size, color } = this.options;
      ctx.save();
      ctx.fillStyle = theme.colors.background;
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      if (!enabled) {
        ctx.restore();
        return;
      }
      const step = size || theme.sizes.grid;
      const gridColor = color || theme.colors.grid;
      const scaledStep = step * camera.zoom;
      const offsetX = (camera.pan.x * camera.zoom) % scaledStep;
      const offsetY = (camera.pan.y * camera.zoom) % scaledStep;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -scaledStep + offsetX; x <= canvasSize.width; x += scaledStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasSize.height);
      }
      for (let y = -scaledStep + offsetY; y <= canvasSize.height; y += scaledStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize.width, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  class CanvasRenderer {
    constructor(canvas, scene, selectionManager, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scene = scene;
      this.selection = selectionManager;
      this.theme = options.theme || DEFAULT_THEME;
      this.grid = new GridLayer({
        enabled: options.grid?.enabled ?? true,
        size: options.grid?.size ?? this.theme.sizes.grid,
        color: options.grid?.color,
      });
      this.camera = {
        zoom: options.zoom?.initial ?? 1,
        pan: { x: 0, y: 0 },
      };
      this.devicePixelRatio = options.devicePixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      this._needsResize = true;
    }
    setTheme(theme) {
      this.theme = theme;
    }
    setGrid(gridOptions) {
      this.grid.options = { ...this.grid.options, ...gridOptions };
    }
    setCamera(camera) {
      this.camera = camera;
    }
    resize(width, height) {
      const dpr = this.devicePixelRatio;
      if (width && height) {
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
      } else if (typeof window !== 'undefined') {
        const rect = this.canvas.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
      } else {
        width = this.canvas.width;
        height = this.canvas.height;
      }
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this._needsResize = false;
    }
    drawFrame() {
      if (this._needsResize) {
        this.resize();
      }
      const canvasSize = {
        width: this.canvas.width / this.devicePixelRatio,
        height: this.canvas.height / this.devicePixelRatio,
      };
      const ctx = this.ctx;
      const theme = this.theme;
      this.grid.draw(ctx, this.camera, theme, canvasSize);
      ctx.save();
      ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-this.camera.pan.x, -this.camera.pan.y);
      this.drawEdges(ctx, theme);
      this.drawTables(ctx, theme);
      this.drawSelection(ctx, theme);
      ctx.restore();
    }
    drawTables(ctx, theme) {
      for (const table of this.scene.tables.values()) {
        this.drawTable(ctx, table, theme);
      }
    }
    drawTable(ctx, table, theme) {
      const { x, y } = table.position;
      const width = table.size.width;
      const padding = theme.sizes.tablePadding;
      const rowHeight = theme.sizes.rowHeight;
      const headerHeight = rowHeight + padding;
      const height = headerHeight + table.fields.length * rowHeight + padding;
      table.size.height = height;
      ctx.save();
      ctx.fillStyle = table.style?.bodyColor || theme.colors.tableBody;
      ctx.strokeStyle = table.style?.borderColor || theme.colors.border;
      ctx.lineWidth = theme.sizes.borderWidth;
      this.roundRect(ctx, x, y, width, height, theme.sizes.cornerRadius);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      this.roundRect(ctx, x, y, width, headerHeight, {
        tl: theme.sizes.cornerRadius,
        tr: theme.sizes.cornerRadius,
        br: 0,
        bl: 0,
      });
      ctx.clip();
      ctx.fillStyle = table.style?.headerColor || theme.colors.tableHeader;
      ctx.fillRect(x, y, width, headerHeight);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = table.style?.textColor || theme.colors.text;
      ctx.font = theme.fonts.header;
      ctx.textBaseline = 'middle';
      ctx.fillText(table.name, x + padding, y + headerHeight / 2);
      ctx.font = theme.fonts.field;
      table.fields.forEach((field, index) => {
        const fieldY = y + headerHeight + index * rowHeight;
        ctx.fillText(field.name, x + padding, fieldY + rowHeight / 2);
        const typeText = field.type || '';
        const metrics = ctx.measureText(typeText);
        ctx.fillText(typeText, x + width - padding - metrics.width, fieldY + rowHeight / 2);
      });
      ctx.restore();
      ctx.restore();
      table._bounds = { x, y, width, height };
      table.fields.forEach((field, index) => {
        field._bounds = {
          x,
          y: y + headerHeight + index * rowHeight,
          width,
          height: rowHeight,
        };
      });
    }
    drawEdges(ctx, theme) {
      ctx.save();
      ctx.strokeStyle = theme.colors.edge;
      ctx.lineWidth = theme.sizes.edgeWidth / this.camera.zoom;
      for (const edge of this.scene.edges.values()) {
        const fromTable = this.scene.getTable(edge.from.tableId);
        const toTable = this.scene.getTable(edge.to.tableId);
        if (!fromTable || !toTable) continue;
        const fromPoint = this.getAnchorPoint(fromTable, edge.from);
        const toPoint = this.getAnchorPoint(toTable, edge.to);
        if (!fromPoint || !toPoint) continue;
        ctx.beginPath();
        ctx.moveTo(fromPoint.x, fromPoint.y);
        (edge.waypoints || []).forEach((wp) => ctx.lineTo(wp.x, wp.y));
        ctx.lineTo(toPoint.x, toPoint.y);
        ctx.stroke();
        if (edge.label) {
          const midX = (fromPoint.x + toPoint.x) / 2;
          const midY = (fromPoint.y + toPoint.y) / 2;
          ctx.save();
          ctx.fillStyle = theme.colors.text;
          ctx.font = theme.fonts.base;
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.label, midX + 8, midY - 8);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    drawSelection(ctx, theme) {
      const sel = this.selection.getSelection();
      if (!sel.tables.length && !sel.fields.length && !sel.edges.length) return;
      ctx.save();
      ctx.strokeStyle = theme.colors.selection;
      ctx.lineWidth = (theme.sizes.borderWidth + 1) / this.camera.zoom;
      ctx.setLineDash([6 / this.camera.zoom, 4 / this.camera.zoom]);
      sel.tables.forEach((id) => {
        const table = this.scene.getTable(id);
        if (!table || !table._bounds) return;
        const { x, y, width, height } = table._bounds;
        ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);
      });
      sel.edges.forEach((id) => {
        const edge = this.scene.getEdge(id);
        if (!edge) return;
        const fromTable = this.scene.getTable(edge.from.tableId);
        const toTable = this.scene.getTable(edge.to.tableId);
        if (!fromTable || !toTable) return;
        const fromPoint = this.getAnchorPoint(fromTable, edge.from);
        const toPoint = this.getAnchorPoint(toTable, edge.to);
        if (!fromPoint || !toPoint) return;
        ctx.beginPath();
        ctx.moveTo(fromPoint.x, fromPoint.y);
        (edge.waypoints || []).forEach((wp) => ctx.lineTo(wp.x, wp.y));
        ctx.lineTo(toPoint.x, toPoint.y);
        ctx.stroke();
      });
      sel.fields.forEach(({ tableId, fieldId }) => {
        const table = this.scene.getTable(tableId);
        if (!table) return;
        const field = table.getField(fieldId);
        if (!field || !field._bounds) return;
        const { x, y, width, height } = field._bounds;
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
      });
      ctx.restore();
    }
    getAnchorPoint(table, ref) {
      if (ref.fieldId) {
        const field = table.getField(ref.fieldId);
        if (field && field._bounds) {
          const { x, y, height } = field._bounds;
          return { x: x + table.size.width, y: y + height / 2 };
        }
      }
      if (table._bounds) {
        const { x, y, width, height } = table._bounds;
        return { x: x + width / 2, y: y + height / 2 };
      }
      return null;
    }
    roundRect(ctx, x, y, width, height, radius) {
      const r = typeof radius === 'number' ? { tl: radius, tr: radius, br: radius, bl: radius } : { tl: 0, tr: 0, br: 0, bl: 0, ...radius };
      ctx.beginPath();
      ctx.moveTo(x + r.tl, y);
      ctx.lineTo(x + width - r.tr, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
      ctx.lineTo(x + width, y + height - r.br);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
      ctx.lineTo(x + r.bl, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
      ctx.lineTo(x, y + r.tl);
      ctx.quadraticCurveTo(x, y, x + r.tl, y);
      ctx.closePath();
    }
  }

  class SelectionManager extends EventEmitter {
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

  class DragManager {
    constructor(scene, selectionManager, options) {
      this.scene = scene;
      this.selection = selectionManager;
      this.options = options;
      this.state = 'idle';
      this.activeTableId = null;
      this.startPointer = null;
      this.startPositions = new Map();
    }
    beginDrag(tableId, pointer, emit) {
      this.state = 'draggingTable';
      this.activeTableId = tableId;
      this.startPointer = { ...pointer };
      const tables = this.selection.getSelection().tables;
      const targets = tables.length && tables.includes(tableId) ? tables : [tableId];
      targets.forEach((id) => {
        const table = this.scene.getTable(id);
        if (table) this.startPositions.set(id, { ...table.position });
      });
      emit('interaction:drag:start', { tableId, pointer });
    }
    update(pointer, emit) {
      if (this.state !== 'draggingTable' || !this.startPointer) return;
      const dx = pointer.x - this.startPointer.x;
      const dy = pointer.y - this.startPointer.y;
      const snap = this.options.grid?.snap;
      const gridSize = this.options.grid?.size || 16;
      this.startPositions.forEach((startPos, id) => {
        const table = this.scene.getTable(id);
        if (!table) return;
        let x = startPos.x + dx;
        let y = startPos.y + dy;
        if (snap) {
          x = Math.round(x / gridSize) * gridSize;
          y = Math.round(y / gridSize) * gridSize;
        }
        table.position.x = x;
        table.position.y = y;
      });
      emit('interaction:drag:move', { pointer });
    }
    end(pointer, emit) {
      if (this.state !== 'draggingTable') return;
      this.state = 'idle';
      this.startPointer = null;
      this.startPositions.clear();
      emit('interaction:drag:end', { pointer });
    }
  }

  class ConnectManager {
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

  class InputController extends EventEmitter {
    constructor(canvas, scene, renderer, selection, dragManager, connectManager, options) {
      super();
      this.canvas = canvas;
      this.scene = scene;
      this.renderer = renderer;
      this.selection = selection;
      this.dragManager = dragManager;
      this.connectManager = connectManager;
      this.options = options;
      this._onMouseDown = (event) => this.onPointerDown(event);
      this._onMouseMove = (event) => this.onPointerMove(event);
      this._onMouseUp = (event) => this.onPointerUp(event);
      this._onWheel = (event) => this.onWheel(event);
      this._bindEvents();
      this.isPanning = false;
      this.lastPointer = null;
    }
    _bindEvents() {
      this.canvas.addEventListener('mousedown', this._onMouseDown);
      if (typeof window !== 'undefined') {
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
      }
      this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    }
    getCanvasPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }
    canvasToScene(point) {
      const { camera } = this.renderer;
      const canvasSize = {
        width: this.canvas.width / this.renderer.devicePixelRatio,
        height: this.canvas.height / this.renderer.devicePixelRatio,
      };
      const x = (point.x - canvasSize.width / 2) / camera.zoom + camera.pan.x;
      const y = (point.y - canvasSize.height / 2) / camera.zoom + camera.pan.y;
      return { x, y };
    }
    hitTestScene(point) {
      for (const table of [...this.scene.tables.values()].reverse()) {
        if (table._bounds && rectContains(table._bounds, point.x, point.y)) {
          for (const field of table.fields) {
            if (field._bounds && rectContains(field._bounds, point.x, point.y)) {
              return { type: 'field', table, field };
            }
          }
          return { type: 'table', table };
        }
      }
      for (const edge of [...this.scene.edges.values()]) {
        const from = this.renderer.getAnchorPoint(this.scene.getTable(edge.from.tableId), edge.from);
        const to = this.renderer.getAnchorPoint(this.scene.getTable(edge.to.tableId), edge.to);
        if (!from || !to) continue;
        const minX = Math.min(from.x, to.x);
        const minY = Math.min(from.y, to.y);
        const maxX = Math.max(from.x, to.x);
        const maxY = Math.max(from.y, to.y);
        if (point.x >= minX - 4 && point.x <= maxX + 4 && point.y >= minY - 4 && point.y <= maxY + 4) {
          return { type: 'edge', edge };
        }
      }
      return null;
    }
    onPointerDown(event) {
      if (this.options.readonly) return;
      const button = event.button;
      const canvasPoint = this.getCanvasPoint(event);
      const scenePoint = this.canvasToScene(canvasPoint);
      this.lastPointer = scenePoint;
      const target = this.hitTestScene(scenePoint);
      const multi = event.shiftKey;
      const panEnabled = this.options.interactions?.pan !== false;
      if (panEnabled && (button === 1 || (button === 0 && (event.altKey || event.metaKey)))) {
        this.isPanning = true;
        this.emit('canvas:pan:start');
        return;
      }
      if (target?.type === 'table' && this.options.interactions?.drag !== false) {
        if (!multi) this.selection.setSelection({ tables: [target.table.id], edges: [], fields: [] });
        else this.selection.toggleTable(target.table.id, true);
        this.dragManager.beginDrag(target.table.id, scenePoint, (name, payload) => this.emit(name, payload));
      } else if (target?.type === 'field' && this.options.interactions?.connect !== false) {
        this.selection.setSelection({
          tables: [target.table.id],
          edges: [],
          fields: [{ tableId: target.table.id, fieldId: target.field.id }],
        });
        this.connectManager.start({ tableId: target.table.id, fieldId: target.field.id }, scenePoint, (name, payload) => this.emit(name, payload));
      } else if (target?.type === 'edge') {
        this.selection.setSelection({ tables: [], edges: [target.edge.id], fields: [] });
      } else if (!target) {
        this.selection.clearSelection();
        if (panEnabled) {
          this.isPanning = true;
          this.emit('canvas:pan:start');
        }
      }
    }
    onPointerMove(event) {
      const canvasPoint = this.getCanvasPoint(event);
      const scenePoint = this.canvasToScene(canvasPoint);
      if (this.isPanning && this.lastPointer) {
        const dx = this.lastPointer.x - scenePoint.x;
        const dy = this.lastPointer.y - scenePoint.y;
        this.renderer.camera.pan.x += dx;
        this.renderer.camera.pan.y += dy;
        this.emit('canvas:pan', { pan: { ...this.renderer.camera.pan } });
      } else {
        this.dragManager.update(scenePoint, (name, payload) => this.emit(name, payload));
        const target = this.hitTestScene(scenePoint);
        if (target && target.type === 'table') {
          this.canvas.style.cursor = 'move';
        } else {
          this.canvas.style.cursor = 'default';
        }
        if (this.connectManager.state === 'connecting') {
          this.connectManager.update(scenePoint, target, (name, payload) => this.emit(name, payload));
        }
      }
      this.lastPointer = scenePoint;
    }
    onPointerUp(event) {
      const canvasPoint = this.getCanvasPoint(event);
      const scenePoint = this.canvasToScene(canvasPoint);
      if (this.isPanning) {
        this.isPanning = false;
        this.emit('canvas:pan:end');
      }
      if (this.connectManager.state === 'connecting') {
        const target = this.hitTestScene(scenePoint);
        if (target?.type === 'field') {
          const edgeSpec = this.connectManager.complete({
            tableId: target.table.id,
            fieldId: target.field.id,
          }, (name, payload) => this.emit(name, payload));
          if (edgeSpec) {
            this.emit('connect:complete', edgeSpec);
          }
        } else {
          this.connectManager.cancel((name, payload) => this.emit(name, payload));
        }
      }
      this.dragManager.end(scenePoint, (name, payload) => this.emit(name, payload));
      this.lastPointer = null;
    }
    onWheel(event) {
      if (this.options.interactions?.zoom === false) return;
      event.preventDefault();
      const zoom = this.options.zoom || {};
      const delta = -event.deltaY;
      const step = zoom.step || 0.1;
      const min = zoom.min || 0.2;
      const max = zoom.max || 3;
      const nextZoom = Math.min(max, Math.max(min, this.renderer.camera.zoom + (delta > 0 ? step : -step)));
      if (nextZoom !== this.renderer.camera.zoom) {
        this.renderer.camera.zoom = nextZoom;
        this.emit('canvas:zoom', { zoom: nextZoom });
      }
    }
    destroy() {
      this.canvas.removeEventListener('mousedown', this._onMouseDown);
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
      }
      this.canvas.removeEventListener('wheel', this._onWheel);
    }
  }

  class Store {
    constructor(options = {}) {
      this.theme = options.theme ? deepMerge(DEFAULT_THEME, options.theme) : DEFAULT_THEME;
      this.grid = {
        enabled: true,
        size: DEFAULT_THEME.sizes.grid,
        snap: false,
        color: DEFAULT_THEME.colors.grid,
        ...options.grid,
      };
      this.camera = {
        zoom: 1,
        pan: { x: 0, y: 0 },
        ...options.camera,
      };
      this.performance = {
        dirtyRect: false,
        maxFPS: 60,
        ...options.performance,
      };
      this.interactions = {
        pan: true,
        zoom: true,
        select: true,
        multiSelect: true,
        drag: true,
        connect: true,
        snapToGrid: options.grid?.snap ?? false,
        ...options.interactions,
      };
    }
  }

  const VERSION = '1.0.0';
  class Serializer {
    constructor(scene, store) {
      this.scene = scene;
      this.store = store;
    }
    toJSON() {
      return {
        version: VERSION,
        ...this.scene.toJSON(),
        camera: {
          zoom: this.store.camera.zoom,
          pan: { ...this.store.camera.pan },
        },
        theme: JSON.parse(JSON.stringify(this.store.theme)),
        grid: { ...this.store.grid },
      };
    }
    fromJSON(json) {
      if (!json || typeof json !== 'object') throw new Error('Invalid diagram JSON');
      if (json.version && json.version !== VERSION) {
        console.warn(`Diagram version ${json.version} differs from library ${VERSION}`);
      }
      this.scene.fromJSON(json);
      if (json.camera) {
        this.store.camera.zoom = json.camera.zoom ?? this.store.camera.zoom;
        this.store.camera.pan = { ...this.store.camera.pan, ...json.camera.pan };
      }
      if (json.theme) {
        this.store.theme = JSON.parse(JSON.stringify(json.theme));
      }
      if (json.grid) {
        this.store.grid = { ...this.store.grid, ...json.grid };
      }
    }
  }

  const PLUGINS = new Set();

  class ERCanvas extends EventEmitter {
    constructor(containerOrCanvas, options = {}) {
      super();
      this.options = options;
      this.container = containerOrCanvas instanceof HTMLCanvasElement ? containerOrCanvas : null;
      if (!this.container) {
        this.container = document.createElement('canvas');
        if (containerOrCanvas instanceof HTMLElement) {
          containerOrCanvas.appendChild(this.container);
        } else {
          throw new Error('ERCanvas requires a canvas or container element');
        }
      }
      this.store = new Store(options);
      this.scene = new Scene();
      this.selection = new SelectionManager();
      this.renderer = new CanvasRenderer(this.container, this.scene, this.selection, {
        theme: this.store.theme,
        grid: this.store.grid,
        zoom: options.zoom,
        devicePixelRatio: options.devicePixelRatio,
      });
      this.renderer.camera = this.store.camera;
      this.dragManager = new DragManager(this.scene, this.selection, { grid: this.store.grid });
      const connectOptions =
        typeof options.interactions?.connect === 'object'
          ? options.interactions.connect
          : {};
      this.connectValidate = typeof connectOptions.validate === 'function' ? connectOptions.validate : null;
      this.connectManager = new ConnectManager(this.scene, connectOptions);
      this.input = new InputController(
        this.container,
        this.scene,
        this.renderer,
        this.selection,
        this.dragManager,
        this.connectManager,
        { ...this.store, ...options }
      );
      this.serializer = new Serializer(this.scene, this.store);
      this._running = false;
      this._frameHandle = null;
      this._pluginsContext = {
        er: this,
        scene: this.scene,
        selection: this.selection,
        renderer: this.renderer,
        store: this.store,
      };
      this._bindInternalEvents();
      this.applyPlugins();
      this.renderer.drawFrame();
      this.emit('ready');
    }
    static use(pluginFn) {
      PLUGINS.add(pluginFn);
    }
    applyPlugins() {
      PLUGINS.forEach((plugin) => {
        try {
          plugin(this._pluginsContext);
        } catch (err) {
          console.error('Plugin error', err);
        }
      });
    }
    _bindInternalEvents() {
      const forward = (event, payload) => this.emit(event, payload);
      this.selection.on('selection:change', (sel) => this.emit('selection:change', sel));
      this.input.on('canvas:pan', (payload) => forward('canvas:pan', payload));
      this.input.on('canvas:pan:start', () => forward('canvas:pan:start'));
      this.input.on('canvas:pan:end', () => forward('canvas:pan:end'));
      this.input.on('canvas:zoom', (payload) => forward('canvas:zoom', payload));
      this.input.on('interaction:drag:start', (payload) => forward('interaction:drag:start', payload));
      this.input.on('interaction:drag:move', (payload) => forward('interaction:drag:move', payload));
      this.input.on('interaction:drag:end', (payload) => forward('interaction:drag:end', payload));
      this.input.on('interaction:connect:start', (payload) => forward('interaction:connect:start', payload));
      this.input.on('interaction:connect:preview', (payload) => forward('interaction:connect:preview', payload));
      this.input.on('interaction:connect:cancel', (payload) => forward('interaction:connect:cancel', payload));
      this.input.on('interaction:connect:complete', (payload) => forward('interaction:connect:complete', payload));
      this.input.on('connect:complete', (edgeSpec) => {
        this.connect(edgeSpec);
      });
    }
    start() {
      if (this._running) return;
      this._running = true;
      const loop = (timestamp) => {
        if (!this._running) return;
        this.emit('render:before', { timestamp });
        this.renderer.drawFrame();
        this.emit('render:after', { timestamp });
        this._frameHandle = requestAnimationFrame(loop);
      };
      this._frameHandle = requestAnimationFrame(loop);
    }
    stop() {
      this._running = false;
      if (this._frameHandle) {
        cancelAnimationFrame(this._frameHandle);
        this._frameHandle = null;
      }
    }
    destroy() {
      this.stop();
      this.input.destroy();
      this.container.remove();
    }
    addTable(tableSpec) {
      const table = tableSpec instanceof TableNode ? tableSpec : new TableNode(tableSpec);
      const id = this.scene.addTable(table);
      this.emit('table:add', { id, table });
      return id;
    }
    updateTable(tableId, partialSpec) {
      if (this.scene.updateTable(tableId, partialSpec)) {
        this.emit('table:update', { id: tableId, changes: partialSpec });
      }
    }
    removeTable(tableId) {
      if (this.scene.removeTable(tableId)) {
        this.emit('table:remove', { id: tableId });
        const selection = this.selection.getSelection();
        const filtered = {
          tables: selection.tables.filter((id) => id !== tableId),
          edges: selection.edges.filter((id) => {
            const edge = this.scene.getEdge(id);
            return edge && edge.from.tableId !== tableId && edge.to.tableId !== tableId;
          }),
          fields: selection.fields.filter((f) => f.tableId !== tableId),
        };
        this.selection.setSelection(filtered);
      }
    }
    getTable(tableId) {
      const snapshot = this.scene.toJSON();
      return snapshot.tables.find((table) => table.id === tableId) || null;
    }
    addField(tableId, fieldSpec) {
      const table = this.scene.getTable(tableId);
      if (!table) throw new Error(`Table ${tableId} not found`);
      const field = fieldSpec instanceof Field ? fieldSpec : new Field(fieldSpec);
      const id = table.addField(field);
      this.emit('field:add', { tableId, field });
      return id;
    }
    updateField(tableId, fieldId, partialSpec) {
      const table = this.scene.getTable(tableId);
      if (!table) throw new Error(`Table ${tableId} not found`);
      if (table.updateField(fieldId, partialSpec)) {
        this.emit('field:update', { tableId, fieldId, changes: partialSpec });
      }
    }
    removeField(tableId, fieldId) {
      const table = this.scene.getTable(tableId);
      if (!table) throw new Error(`Table ${tableId} not found`);
      if (table.removeField(fieldId)) {
        this.emit('field:remove', { tableId, fieldId });
      }
    }
    reorderField(tableId, fieldId, newIndex) {
      const table = this.scene.getTable(tableId);
      if (!table) throw new Error(`Table ${tableId} not found`);
      if (table.reorderField(fieldId, newIndex)) {
        this.emit('field:reorder', { tableId, fieldId, newIndex });
      }
    }
    connect(edgeSpec) {
      if (this.connectValidate && !this.connectValidate(edgeSpec.from, edgeSpec.to)) {
        this.emit('interaction:connect:cancel', { reason: 'validate' });
        return null;
      }
      const edge = edgeSpec instanceof Edge ? edgeSpec : new Edge(edgeSpec);
      const id = this.scene.addEdge(edge);
      this.emit('edge:add', { id, edge });
      return id;
    }
    updateEdge(edgeId, partialSpec) {
      if (this.scene.updateEdge(edgeId, partialSpec)) {
        this.emit('edge:update', { id: edgeId, changes: partialSpec });
      }
    }
    removeEdge(edgeId) {
      if (this.scene.removeEdge(edgeId)) {
        this.emit('edge:remove', { id: edgeId });
        const selection = this.selection.getSelection();
        if (selection.edges.includes(edgeId)) {
          this.selection.setSelection({
            tables: selection.tables,
            edges: selection.edges.filter((id) => id !== edgeId),
            fields: selection.fields,
          });
        }
      }
    }
    getEdge(edgeId) {
      const snapshot = this.scene.toJSON();
      return snapshot.edges.find((edge) => edge.id === edgeId) || null;
    }
    zoomIn() {
      this.setZoom(this.renderer.camera.zoom + (this.options.zoom?.step || 0.1));
    }
    zoomOut() {
      this.setZoom(this.renderer.camera.zoom - (this.options.zoom?.step || 0.1));
    }
    setZoom(value) {
      const { min = 0.2, max = 3 } = this.options.zoom || {};
      const next = Math.min(max, Math.max(min, value));
      this.renderer.camera.zoom = next;
      this.emit('canvas:zoom', { zoom: next });
    }
    getZoom() {
      return this.renderer.camera.zoom;
    }
    panBy(dx, dy) {
      this.renderer.camera.pan.x += dx;
      this.renderer.camera.pan.y += dy;
      this.emit('canvas:pan', { pan: { ...this.renderer.camera.pan } });
    }
    setPan(x, y) {
      this.renderer.camera.pan = { x, y };
      this.emit('canvas:pan', { pan: { ...this.renderer.camera.pan } });
    }
    getPan() {
      return { ...this.renderer.camera.pan };
    }
    fitToScreen(padding = 50) {
      const tables = [...this.scene.tables.values()];
      if (!tables.length) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      tables.forEach((table) => {
        const { x, y } = table.position;
        const width = table.size.width;
        const height = table.size.height;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
      });
      const rect = this.container.getBoundingClientRect();
      const width = rect.width - padding * 2;
      const height = rect.height - padding * 2;
      const scaleX = width / (maxX - minX);
      const scaleY = height / (maxY - minY);
      const zoom = Math.max(0.1, Math.min(scaleX, scaleY));
      this.setZoom(zoom);
      this.setPan((minX + maxX) / 2, (minY + maxY) / 2);
    }
    setTheme(theme) {
      this.store.theme = deepMerge(DEFAULT_THEME, theme);
      this.renderer.setTheme(this.store.theme);
      this.emit('theme:change', this.store.theme);
    }
    getTheme() {
      return this.store.theme;
    }
    setGrid(gridOptions) {
      this.store.grid = { ...this.store.grid, ...gridOptions };
      this.renderer.setGrid(this.store.grid);
      this.dragManager.options.grid = this.store.grid;
      this.emit('grid:change', this.store.grid);
    }
    getSelection() {
      return this.selection.getSelection();
    }
    setSelection(sel) {
      this.selection.setSelection(sel);
    }
    clearSelection() {
      this.selection.clearSelection();
    }
    toJSON() {
      return this.serializer.toJSON();
    }
    fromJSON(json) {
      this.serializer.fromJSON(json);
      this.emit('scene:load', json);
    }
  }

  return {
    ERCanvas,
    DEFAULT_THEME,
    TableNode,
    Field,
    Edge,
  };
});
