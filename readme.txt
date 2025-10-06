Technical Specification: Framework-Agnostic Base Library for ER Diagrams (JavaScript/TypeScript)

1. Summary
- Build a minimal, framework-agnostic library in plain JavaScript (optionally TypeScript) to render and interact with ER diagrams on HTML5 Canvas.
- The library provides the lowest-level primitives: canvas rendering, scene graph, elements (tables with fields, edges/associations), interaction (selection, dragging, connecting), state management, and serialization.
- A facade-based public API should make it easy for client code to use and extend without React/Vue or any external UI frameworks.

2. Goals
- Zero external framework dependency (React/Vue not allowed). No build required for JS version.
- Clean, small, and modular core with a facade for ergonomic usage.
- Support: tables (nodes), fields (attributes within a table), and connections (edges/associations).
- Provide rendering on Canvas 2D with basic interaction: pan, zoom, select, drag, connect.
- Provide a stable, documented public API and event system.
- Provide JSON-based serialization/deserialization.
- Provide optional TypeScript build with type definitions.

3. Non-Goals (for v1)
- No advanced auto-layout or complex routing (basic straight/orthogonal only).
- No text editing widgets (leave to client via hooks).
- No persistence backend; client handles storage.
- No external styling library; basic styling options only.
- No accessibility/ARIA for canvas-based interactions in v1 (can be future work).

4. Target Environment
- Browser-only, ES2018+ compatible.
- Modern browsers (Chrome 90+, Firefox 90+, Safari 14+, Edge 90+).
- No Node.js runtime requirement for the library runtime (Node only for optional build/tests).

5. High-Level Architecture
- Facade: ERCanvas (or ERDiagram) — single entry point to manage scene, rendering, and interactions.
- Core modules:
  - EventEmitter: Pub/sub for internal and public events.
  - Geometry: Point, Rect, Matrix utilities; hit-testing helpers.
  - SceneGraph: Scene, Node, Edge, Port abstractions.
  - Elements: TableNode (with Field items), Edge (association), Anchors/Ports.
  - Renderer: CanvasRenderer for draw cycles; Layering (grid, edges, nodes, overlays).
  - Input: InputController for mouse/touch/keyboard; SelectionManager; DragManager; ConnectManager.
  - State: Store for scene state; CommandManager (optional) for undo/redo.
  - Serialization: JSON serializer/deserializer with schema versioning.
  - Utils: Id generator, color utils, DPI scaling, throttle/debounce, deep-merge.

6. Public API (Facade)
Class: ERCanvas
Constructor: new ERCanvas(containerOrCanvas, options?)
- containerOrCanvas: HTMLCanvasElement or HTMLElement (if HTMLElement, library creates/manages a Canvas).
- options (optional):
  - width, height (number | 'auto')
  - devicePixelRatio (auto-detect if undefined)
  - theme: colors, fonts, line widths
  - grid: { enabled, size, color, snap }
  - interactions: { pan, zoom, select, multiSelect, drag, connect, snapToGrid }
  - zoom: { min, max, step, mode: 'wheel'|'pinch'|'none' }
  - routing: 'straight'|'orthogonal'
  - performance: { dirtyRect, maxFPS }
  - readonly: boolean

Core methods:
- addTable(tableSpec) => tableId
- updateTable(tableId, partialSpec) => void
- removeTable(tableId) => void
- getTable(tableId) => TableModel | null
- addField(tableId, fieldSpec) => fieldId
- updateField(tableId, fieldId, partialSpec) => void
- removeField(tableId, fieldId) => void
- reorderField(tableId, fieldId, newIndex) => void
- connect(edgeSpec) => edgeId
- updateEdge(edgeId, partialSpec) => void
- removeEdge(edgeId) => void
- getEdge(edgeId) => EdgeModel | null
- toJSON() => DiagramJSON
- fromJSON(json) => void
- zoomIn(), zoomOut(), setZoom(zoom), getZoom()
- panBy(dx, dy), setPan(x, y), getPan()
- fitToScreen(padding?)
- setTheme(theme), getTheme()
- setGrid(gridOptions)
- getSelection() => { tables: string[], edges: string[], fields: Array<{tableId, fieldId}> }
- setSelection(sel), clearSelection()
- start(), stop()  // start/stop render loop if needed
- destroy()

Event API:
- on(eventName, handler), off(eventName, handler), once(eventName, handler)

Events (suggested):
- 'ready'
- 'render:before', 'render:after'
- 'table:add', 'table:update', 'table:remove'
- 'field:add', 'field:update', 'field:remove', 'field:reorder'
- 'edge:add', 'edge:update', 'edge:remove'
- 'selection:change'
- 'canvas:zoom', 'canvas:pan', 'canvas:resize'
- 'interaction:drag:start|move|end'
- 'interaction:connect:start|preview|cancel|complete'
- 'error'

7. Data Models
Table (Node) model fields:
- id: string
- name: string
- position: { x: number, y: number }
- size: { width: number, height: number } // height can be auto from fields
- fields: Field[]
- ports: optional per-field or per-side anchors (computed if not supplied)
- style: { headerColor, bodyColor, borderColor, textColor, font, radius, shadow? }
- metadata: arbitrary object (client-controlled)

Field model:
- id: string
- name: string
- type: string
- isPrimaryKey?: boolean
- isForeignKey?: boolean
- isNullable?: boolean
- isUnique?: boolean
- defaultValue?: string
- comment?: string
- style?: { iconFlags?, textColor?, font? }
- metadata?: any

Edge (Association):
- id: string
- from: { tableId: string, fieldId?: string, portId?: string }
- to: { tableId: string, fieldId?: string, portId?: string }
- cardinality?: { from: '0'|'1'|'N', to: '0'|'1'|'N' }
- identifying?: boolean
- relationship?: 'one-to-one'|'one-to-many'|'many-to-many'|'custom'
- waypoints?: Array<{ x, y }> // for manual bends
- style?: { color, width, dash?, arrowStart?, arrowEnd?, labelStyle? }
- label?: string
- metadata?: any

Diagram JSON:
- version: string
- tables: Table[]
- edges: Edge[]
- camera: { zoom: number, pan: { x, y } }
- theme?: Theme
- grid?: GridOptions

8. Rendering
- HTML5 Canvas 2D.
- DPI aware: scale by devicePixelRatio to avoid blurriness.
- Layers rendering order:
  1) background (grid)
  2) edges
  3) nodes (tables, fields)
  4) selection and interaction overlays (drag handles, connect hints)
- Dirty rectangle or simple full redraw per frame based on performance options.
- Hit testing:
  - Maintain bounding boxes for nodes, fields, edge segments.
  - Fast point-in-rect testing; optional per-pixel is not required.
- Styling:
  - Theming options (colors, fonts, sizes).
  - Defaults provided; client can override via setTheme or per-element style.

9. Interaction Model
- Mouse:
  - Left click: select node/field/edge.
  - Shift+click: toggle selection.
  - Drag node: move table (snap to grid if enabled).
  - Drag field within table: reorder fields (optional).
  - Drag from port/field: create connection preview; drop onto compatible target to create edge.
  - Drag background: pan.
  - Mouse wheel: zoom (configurable).
  - Drag selection rectangle on empty space (with modifier) for multi-select.
- Touch:
  - One-finger pan, two-finger pinch zoom (if enabled).
- Keyboard (optional basic):
  - Delete: remove selection.
  - Ctrl/Cmd+A: select all.
  - Arrow keys: nudge selected tables by 1px (or grid size with Shift).
- Readonly mode disables interactions that alter the model.

10. Connections and Ports
- Default ports:
  - Per-field ports (one on the right/left of each field).
  - Optional side ports (top/bottom/left/right) if no field is chosen.
- Connection rules:
  - Allow connecting table-to-table or field-to-field; client can enforce rules via a validation hook: options.interactions.connect.validate(from, to) => boolean.
- Routing:
  - 'straight': direct line.
  - 'orthogonal': Manhattan routing with minimal bends, simple solver.
  - Respect waypoints if provided.

11. Selection and Dragging
- SelectionManager handles selected items with consistent z-index rendering.
- DragManager with states: idle, draggingNode, draggingSelection, connecting, resizing? (resizing can be deferred; optional width resize).
- Snap to grid option.
- Alignment guides (optional basic): when edges of two tables align within a threshold.

12. Undo/Redo (optional in v1, recommended)
- CommandManager to wrap mutating actions (add/remove/update).
- API: undo(), redo(), canUndo(), canRedo(); emit events 'history:change'.
- If omitted in v1, keep architecture allowing later addition.

13. Serialization
- toJSON/fromJSON methods use a versioned schema.
- Validate and migrate older versions gracefully.
- Preserve IDs; if conflicts on import, auto-rewrite and report mapping via event.

14. Extensibility
- Plugin system (lightweight):
  - ERCanvas.use(pluginFn) where pluginFn(ctx) can subscribe to events, add tools, augment API via symbols/namespaced fields.
- Custom elements:
  - Allow registration of custom node types with draw and hit-test callbacks.
- Hooks:
  - Before/after action hooks (e.g., beforeAddTable, beforeConnect) via events or options callbacks.

15. Error Handling and Logging
- Throw or emit 'error' events with codes and messages for misuse (e.g., connect invalid IDs).
- Option debug flag for console logs; no external logging dependency.

16. Performance Considerations
- Efficient redraw on changes; requestAnimationFrame loop throttled by changes.
- Batched updates (beginUpdate/endUpdate) to minimize intermediate redraws.
- Large diagram guidance: target 500 nodes and 1000 edges at interactive 30–60 FPS on modern hardware.

17. Theming and Styling
- Global theme structure:
  - colors: background, grid, tableHeader, tableBody, border, text, edge, selection
  - fonts: base, header, field
  - sizes: grid, tablePadding, rowHeight, borderWidth, edgeWidth, cornerRadius
- Per-element style overrides supported in model.

18. API Usage Example (JS)
- const er = new ERCanvas(document.getElementById('canvas'), { grid: { enabled: true, size: 16, snap: true } });
- const usersId = er.addTable({ id: 'Users', name: 'Users', position: { x: 100, y: 100 }, fields: [
    { id: 'id', name: 'id', type: 'uuid', isPrimaryKey: true },
    { id: 'email', name: 'email', type: 'text', isUnique: true },
  ]});
- const postsId = er.addTable({ id: 'Posts', name: 'Posts', position: { x: 400, y: 120 }, fields: [
    { id: 'id', name: 'id', type: 'uuid', isPrimaryKey: true },
    { id: 'user_id', name: 'user_id', type: 'uuid', isForeignKey: true },
  ]});
- const edgeId = er.connect({ from: { tableId: usersId, fieldId: 'id' }, to: { tableId: postsId, fieldId: 'user_id' }, cardinality: { from: '1', to: 'N' }});
- er.on('selection:change', sel => console.log(sel));

19. Minimal Public Types (TypeScript option, JS JSDoc equivalents for JS build)
- Define interfaces for TableSpec, FieldSpec, EdgeSpec, Theme, GridOptions, DiagramJSON.
- Provide .d.ts bundled for JS build or TS build emits types automatically.

20. File/Module Structure
- src/
  - core/EventEmitter.ts
  - core/Id.ts
  - core/Utils.ts
  - geom/Point.ts, Rect.ts, Matrix.ts
  - model/Scene.ts, Node.ts, TableNode.ts, Field.ts, Edge.ts, Port.ts
  - render/CanvasRenderer.ts, Layers.ts, Theme.ts, Grid.ts
  - input/InputController.ts, SelectionManager.ts, DragManager.ts, ConnectManager.ts
  - state/Store.ts, CommandManager.ts
  - io/Serializer.ts
  - facade/ERCanvas.ts
- dist/
  - er-canvas.js (UMD), er-canvas.esm.js (ESM)
  - er-canvas.d.ts (for JS build with types)
- examples/ (vanilla JS demos)
- docs/

21. Build and Packaging
- JavaScript primary deliverable: single file UMD and ESM with no runtime dependencies; can be used via <script> or ES modules.
- TypeScript (optional):
  - Emit ESM and UMD builds plus .d.ts.
  - tsconfig targets ES2018, DOM libs.
- No CSS dependency. All styling drawn via Canvas.

22. Testing
- Unit tests for:
  - Model mutations, serialization round-trip.
  - Geometry and hit-testing.
  - Event system.
- Integration tests (headless canvas via OffscreenCanvas or jsdom+canvas mock) for:
  - Rendering of nodes/edges basic.
  - Interactions (simulate events).
- Manual examples to verify pan/zoom/select/connect.

23. Documentation
- Quick start guide.
- API reference for ERCanvas and models.
- Events list and examples.
- Serialization format.
- Theming guide.
- Extensibility guide (plugins, custom nodes).
- Migration notes for schema version changes.

24. Acceptance Criteria
- The library runs in a plain HTML page with a single <canvas> tag and no bundler.
- Can create tables and fields, move tables, select elements, and connect tables/fields with edges.
- Pan and zoom work smoothly; grid renders and optional snap-to-grid works for moves.
- JSON export/import reproduces the same diagram including positions and connections.
- Public API and events behave per spec; documentation provided.
- JS build has zero external dependencies; TS build optional with .d.ts.
- Performance acceptable for 100+ tables and 200+ edges at interactive framerates on modern browsers.

25. Milestones
- M1: Core scaffolding, EventEmitter, geometry utils, Scene and basic CanvasRenderer, static render of tables and edges.
- M2: Hit-testing, selection, pan/zoom, drag move tables.
- M3: Fields within tables with per-field ports; connect interactions; edge rendering with labels/cardinality.
- M4: Grid rendering and snapping; theming; serialization/deserialization v1.
- M5: API stabilization, documentation, examples; packaging (UMD/ESM).
- M6 (optional): Undo/redo, orthogonal routing, alignment guides, TS typings polish.

26. Coding Conventions
- Plain JS build must use strict mode and ES modules if possible; provide UMD for legacy script inclusion.
- No global namespace pollution; namespace under ERCanvas for UMD.
- Defensive programming on public API (validate inputs); meaningful error messages.

27. Security and Privacy
- No network calls; entirely client-side.
- No user data collection; no telemetry.

Optional TypeScript Notes
- If implemented in TS, expose types: ERCanvasOptions, TableSpec, FieldSpec, EdgeSpec, DiagramJSON, Theme, GridOptions.
- Provide JSDoc in JS build, mirroring TS types for editor intellisense if TS not used.

End of Technical Specification.
