declare module 'react-simple-maps' {
  import { ComponentType, SVGProps, MouseEvent, ReactNode } from 'react';

  export interface Geography {
    rsmKey: string;
    id: string | number;
    [key: string]: any;
  }

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
      [key: string]: any;
    };
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: Geography[] }) => ReactNode;
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: Geography;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeLinejoin?: string;
    /** style overrides per interaction state (accepts CSS and SVG presentation attributes) */
    style?: {
      default?: Record<string, any>;
      hover?: Record<string, any>;
      pressed?: Record<string, any>;
    };
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseMove?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
}
