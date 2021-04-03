import * as React from "react";
import { BoardEdge, Position, Size } from "./types";

export const BoardContext = React.createContext<{
  optimisticPositions: Map<string, Position>;
  optimisticSizes: Map<string, Size>;
  setOptimisticPosition: (path: string, optPosition: Position | null) => void;
  setOptimisticSize: (path: string, optSize: Size | null) => void;
}>({
  optimisticSizes: new Map(),
  optimisticPositions: new Map(),
  setOptimisticPosition: () => {},
  setOptimisticSize: () => {},
});

export function useBoardEdgeSize(edge: BoardEdge) {
  const { optimisticSizes } = React.useContext(BoardContext);

  const optimisticSize = optimisticSizes.get(edge.dest);

  return optimisticSize || edge.size;
}

export function useBoardEdgePosition(edge: BoardEdge) {
  const { optimisticPositions } = React.useContext(BoardContext);

  const optimisticPosition = optimisticPositions.get(edge.dest);

  return optimisticPosition || edge.size;
}

type BoardStoreAction =
  | {
      type: "set-size";
      path: string;
      size: Size;
    }
  | {
      type: "set-position";
      path: string;
      position: Position;
    }
  | {
      type: "unset-size";
      path: string;
    }
  | {
      type: "unset-position";
      path: string;
    };

type BoardStoreState = {
  positions: Map<string, Position>;
  sizes: Map<string, Size>;
};

function boardReducer(
  state: BoardStoreState,
  action: BoardStoreAction
): BoardStoreState {
  switch (action.type) {
    case "set-position":
      state.positions.set(action.path, action.position);
      return { ...state };
    case "set-size":
      state.sizes.set(action.path, action.size);
      return { ...state };
    case "unset-size":
      state.sizes.delete(action.path);
      return { ...state };
    case "unset-position":
      state.positions.delete(action.path);
      return { ...state };
    default:
      return state;
  }
}

export default function BoardStore({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = React.useReducer(boardReducer, {
    sizes: new Map(),
    positions: new Map(),
  });

  return (
    <BoardContext.Provider
      value={{
        optimisticPositions: state.positions,
        optimisticSizes: state.sizes,
        setOptimisticPosition: (path, position) => {
          if (position) {
            dispatch({ type: "set-position", path, position });

            return;
          }

          dispatch({ type: "unset-position", path });
        },
        setOptimisticSize: (path, size) => {
          if (size) {
            dispatch({ type: "set-size", path, size });

            return;
          }

          dispatch({ type: "unset-size", path });
        },
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}
