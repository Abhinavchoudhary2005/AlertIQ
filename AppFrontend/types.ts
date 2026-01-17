// types.ts
export interface RouteOption {
  coords: {
    latitude: number;
    longitude: number;
  }[];
  distance: number;
  duration: number;
  summary: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface Suggestion {
  label: string;
  coords: {
    latitude: number;
    longitude: number;
  };
}
