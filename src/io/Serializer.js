const VERSION = '1.0.0';

export class Serializer {
  constructor(scene, store) {
    this.scene = scene;
    this.store = store;
  }

  toJSON() {
    return {
      version: VERSION,
      tables: [...this.scene.tables.values()].map((table) => ({
        ...table,
        fields: table.fields.map((field) => ({ ...field })),
      })),
      edges: [...this.scene.edges.values()].map((edge) => ({ ...edge })),
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
      // simple migration stub
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
