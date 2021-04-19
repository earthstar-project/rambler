export type Position = { x: number; y: number };
export type Size = { width: number; height: number };

export type BoardEdge = {
  position: Position;
  size: Size;
  dest: string;
  source: string;
  owner: string;
  path: string;
};
