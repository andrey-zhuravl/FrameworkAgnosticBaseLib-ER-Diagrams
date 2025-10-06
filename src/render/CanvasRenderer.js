import { DEFAULT_THEME } from './Theme.js';
import { GridLayer } from './Grid.js';

export class CanvasRenderer {
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
    this.devicePixelRatio = options.devicePixelRatio || window.devicePixelRatio || 1;
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
    } else {
      const rect = this.canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
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
    const r = typeof radius === 'number'
      ? { tl: radius, tr: radius, br: radius, bl: radius }
      : { tl: 0, tr: 0, br: 0, bl: 0, ...radius };
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
