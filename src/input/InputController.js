import { EventEmitter } from '../core/EventEmitter.js';
import { containsRect } from '../geom/Rect.js';

export class InputController extends EventEmitter {
  constructor(canvas, scene, renderer, selection, dragManager, connectManager, options) {
    super();
    this.canvas = canvas;
    this.scene = scene;
    this.renderer = renderer;
    this.selection = selection;
    this.dragManager = dragManager;
    this.connectManager = connectManager;
    this.options = options;
    this._bindEvents();
    this.isPanning = false;
    this.lastPointer = null;
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (event) => this.onPointerDown(event));
    window.addEventListener('mousemove', (event) => this.onPointerMove(event));
    window.addEventListener('mouseup', (event) => this.onPointerUp(event));
    this.canvas.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
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
      if (table._bounds && containsRect(table._bounds, point.x, point.y)) {
        for (const field of table.fields) {
          if (field._bounds && containsRect(field._bounds, point.x, point.y)) {
            return { type: 'field', table, field };
          }
        }
        return { type: 'table', table };
      }
    }
    for (const edge of [...this.scene.edges.values()]) {
      // simple bounding box check between endpoints
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
    const { zoom } = this.options;
    const delta = -event.deltaY;
    const step = zoom?.step || 0.1;
    const min = zoom?.min || 0.2;
    const max = zoom?.max || 3;
    const nextZoom = Math.min(max, Math.max(min, this.renderer.camera.zoom + (delta > 0 ? step : -step)));
    if (nextZoom !== this.renderer.camera.zoom) {
      this.renderer.camera.zoom = nextZoom;
      this.emit('canvas:zoom', { zoom: nextZoom });
    }
  }
}
