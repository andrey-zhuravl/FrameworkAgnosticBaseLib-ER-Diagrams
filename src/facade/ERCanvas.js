import { EventEmitter } from '../core/EventEmitter.js';
import { deepMerge } from '../core/Utils.js';
import { Scene } from '../model/Scene.js';
import { TableNode } from '../model/TableNode.js';
import { Field } from '../model/Field.js';
import { Edge } from '../model/Edge.js';
import { CanvasRenderer } from '../render/CanvasRenderer.js';
import { SelectionManager } from '../input/SelectionManager.js';
import { DragManager } from '../input/DragManager.js';
import { ConnectManager } from '../input/ConnectManager.js';
import { InputController } from '../input/InputController.js';
import { Store } from '../state/Store.js';
import { Serializer } from '../io/Serializer.js';
import { DEFAULT_THEME } from '../render/Theme.js';

const PLUGINS = new Set();

export class ERCanvas extends EventEmitter {
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
    this.renderer = new CanvasRenderer(
      this.container,
      this.scene,
      this.selection,
      {
        theme: this.store.theme,
        grid: this.store.grid,
        zoom: options.zoom,
        devicePixelRatio: options.devicePixelRatio,
      }
    );
    this.renderer.camera = this.store.camera;

    this.dragManager = new DragManager(this.scene, this.selection, { grid: this.store.grid });
    const connectOptions =
      typeof options.interactions?.connect === 'object'
        ? options.interactions.connect
        : {};
    this.connectValidate =
      typeof connectOptions.validate === 'function' ? connectOptions.validate : null;
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

  // Table API
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

  // Camera
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
