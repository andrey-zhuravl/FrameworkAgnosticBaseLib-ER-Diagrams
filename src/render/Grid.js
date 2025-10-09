export class GridLayer {
  constructor(options) {
    this.options = options;
  }

  draw(ctx, camera, theme, canvasSize) {
    const { enabled, size, color } = this.options;
    if (!enabled) return;
    const step = size || theme.sizes.grid;
    const gridColor = color || theme.colors.grid;
    const scaledStep = step * camera.zoom;
    const offsetX = (camera.pan.x * camera.zoom) % scaledStep;
    const offsetY = (camera.pan.y * camera.zoom) % scaledStep;

    ctx.save();
    ctx.fillStyle = theme.colors.background;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
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
