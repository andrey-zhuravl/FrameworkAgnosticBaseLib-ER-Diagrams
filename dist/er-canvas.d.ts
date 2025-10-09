export interface FieldSpec {
  id?: string;
  name: string;
  type?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNullable?: boolean;
  isUnique?: boolean;
  defaultValue?: string | null;
  comment?: string;
  style?: Record<string, any>;
  metadata?: any;
}

export interface TableSpec {
  id?: string;
  name: string;
  position?: { x: number; y: number };
  size?: { width?: number; height?: number };
  fields?: FieldSpec[];
  ports?: any;
  style?: Record<string, any>;
  metadata?: any;
}

export interface EdgeSpec {
  id?: string;
  from: { tableId: string; fieldId?: string; portId?: string };
  to: { tableId: string; fieldId?: string; portId?: string };
  cardinality?: { from?: '0' | '1' | 'N'; to?: '0' | '1' | 'N' };
  identifying?: boolean;
  relationship?: string;
  waypoints?: Array<{ x: number; y: number }>;
  style?: Record<string, any>;
  label?: string;
  metadata?: any;
}

export interface DiagramJSON {
  version: string;
  tables: TableSpec[];
  edges: EdgeSpec[];
  camera: { zoom: number; pan: { x: number; y: number } };
  theme?: any;
  grid?: any;
}

export interface YjsSyncPluginOptions {
  doc: any;
  mapName?: string;
  sceneKey?: string;
  provider?: { connect?: () => void; disconnect?: () => void; shouldConnect?: boolean } | null;
  onSynced?: (payload: { source: 'local' | 'remote'; data: DiagramJSON }) => void;
}

export declare function createYjsSyncPlugin(options: YjsSyncPluginOptions): (context: { er: ERCanvas }) => void;

export interface ERCanvasOptions {
  width?: number | 'auto';
  height?: number | 'auto';
  devicePixelRatio?: number;
  theme?: any;
  grid?: { enabled?: boolean; size?: number; snap?: boolean; color?: string };
  interactions?: {
    pan?: boolean;
    zoom?: boolean;
    select?: boolean;
    multiSelect?: boolean;
    drag?: boolean;
    connect?: boolean | { validate?: (from: any, to: any) => boolean };
    snapToGrid?: boolean;
  };
  zoom?: { min?: number; max?: number; step?: number; mode?: 'wheel' | 'pinch' | 'none' };
  routing?: 'straight' | 'orthogonal';
  performance?: { dirtyRect?: boolean; maxFPS?: number };
  readonly?: boolean;
}

export declare class ERCanvas {
  constructor(container: HTMLElement | HTMLCanvasElement, options?: ERCanvasOptions);
  start(): void;
  stop(): void;
  destroy(): void;
  addTable(spec: TableSpec): string;
  updateTable(tableId: string, spec: Partial<TableSpec>): void;
  removeTable(tableId: string): void;
  getTable(tableId: string): TableSpec | null;
  addField(tableId: string, spec: FieldSpec): string;
  updateField(tableId: string, fieldId: string, spec: Partial<FieldSpec>): void;
  removeField(tableId: string, fieldId: string): void;
  reorderField(tableId: string, fieldId: string, newIndex: number): void;
  connect(spec: EdgeSpec): string | null;
  updateEdge(edgeId: string, spec: Partial<EdgeSpec>): void;
  removeEdge(edgeId: string): void;
  getEdge(edgeId: string): EdgeSpec | null;
  zoomIn(): void;
  zoomOut(): void;
  setZoom(value: number): void;
  getZoom(): number;
  panBy(dx: number, dy: number): void;
  setPan(x: number, y: number): void;
  getPan(): { x: number; y: number };
  fitToScreen(padding?: number): void;
  setTheme(theme: any): void;
  getTheme(): any;
  setGrid(grid: any): void;
  getSelection(): { tables: string[]; edges: string[]; fields: Array<{ tableId: string; fieldId: string }> };
  setSelection(sel: { tables?: string[]; edges?: string[]; fields?: Array<{ tableId: string; fieldId: string }> }): void;
  clearSelection(): void;
  toJSON(): DiagramJSON;
  fromJSON(json: DiagramJSON): void;
  on(event: string, handler: (...args: any[]) => void): () => void;
  off(event: string, handler: (...args: any[]) => void): void;
  once(event: string, handler: (...args: any[]) => void): () => void;
}

export { TableSpec, FieldSpec, EdgeSpec };
export const DEFAULT_THEME: any;
