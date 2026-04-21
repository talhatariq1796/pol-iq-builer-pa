// src/lib/map/mapActions.ts
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import { SimpleLineSymbol, SimpleFillSymbol } from "@arcgis/core/symbols";
import Color from "@arcgis/core/Color";

export class MapActions {
  public initialCenter?: __esri.Point;
  public initialExtent?: __esri.Extent;
  private view: MapView;
  private highlightLayer: __esri.GraphicsLayer;

  constructor(view: MapView) {
    this.view = view;
    this.highlightLayer = new __esri.GraphicsLayer({
      id: "highlightLayer",
      title: "Highlighted Features"
    });
    this.view.map.add(this.highlightLayer);
  }

  async highlightFeatures(features: __esri.Graphic[]) {
    if (!features.length) return;

    // Clear existing highlights
    this.clearHighlights();

    // Create highlight symbols
    const highlightFill = new SimpleFillSymbol({
      color: new Color([51, 168, 82, 0.2]), // Light green with transparency
      outline: new SimpleLineSymbol({
        color: new Color([51, 168, 82, 1]), // Solid green outline
        width: 2
      })
    });

    // Create highlight graphics
    const highlightGraphics = features.map(feature => {
      return new Graphic({
        geometry: feature.geometry,
        symbol: highlightFill,
        attributes: feature.attributes
      });
    });

    // Add highlights to the layer
    this.highlightLayer.addMany(highlightGraphics);

    // Zoom to features with padding
    await this.view.goTo(features.map(f => f.geometry), {
      duration: 1000,
      easing: "ease-out"
    });

    // Flash the highlights
    this.flashHighlights();
  }

  private async flashHighlights() {
    const flashCount = 3;
    const flashDuration = 500;

    for (let i = 0; i < flashCount; i++) {
      await this.setHighlightOpacity(0.6);
      await new Promise(resolve => setTimeout(resolve, flashDuration));
      await this.setHighlightOpacity(0.2);
      await new Promise(resolve => setTimeout(resolve, flashDuration));
    }
  }

  private async setHighlightOpacity(opacity: number) {
    this.highlightLayer.graphics.forEach(graphic => {
      const symbol = graphic.symbol as __esri.SimpleFillSymbol;
      const color = symbol.color.clone();
      color.a = opacity;
      symbol.color = color;
    });
  }

  clearHighlights() {
    if (this.highlightLayer) {
      this.highlightLayer.removeAll();
    }
  }
}