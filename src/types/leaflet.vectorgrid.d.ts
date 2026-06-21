import 'leaflet'

declare module 'leaflet' {
  namespace vectorGrid {
    function protobuf(url: string, options?: Record<string, unknown>): GridLayer
  }
}
