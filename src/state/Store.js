import { DEFAULT_THEME } from '../render/Theme.js';
import { deepMerge } from '../core/Utils.js';

export class Store {
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
