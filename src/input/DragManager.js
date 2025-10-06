export class DragManager {
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
