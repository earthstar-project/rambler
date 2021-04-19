import * as React from "react";
import { AuthorLabel, useCurrentAuthor, useStorage } from "react-earthstar";
import { useGesture } from "react-use-gesture";
import { useId } from "@reach/auto-id";
import { formatDistance } from "date-fns";
import { useSetBoardEdge } from "./useEdges";
import { SelectionContext } from "./SelectionContext";
import { BoardEdge, Size } from "./types";
import { useUnlinkDocFromBoard } from "./utils";

type SelectionState = "hovered" | "blurred" | "focused" | "editing";
type DragOperation =
  | "none"
  | "n-resize"
  | "ne-resize"
  | "e-resize"
  | "se-resize"
  | "s-resize"
  | "sw-resize"
  | "w-resize"
  | "nw-resize"
  | "move";
function dragOperationFromRelativePositions(positions: {
  top: number;
  left: number;
  right: number;
  bottom: number;
}): DragOperation {
  const matches = {
    top: Math.abs(positions.top) < 5,
    left: Math.abs(positions.left) < 5,
    bottom: Math.abs(positions.bottom) < 5,
    right: Math.abs(positions.right) < 5,
  };

  if (matches.top && matches.left) {
    return "nw-resize";
  }

  if (matches.top && matches.right) {
    return "ne-resize";
  }

  if (matches.bottom && matches.left) {
    return "sw-resize";
  }

  if (matches.bottom && matches.right) {
    return "se-resize";
  }

  if (matches.top) {
    return "n-resize";
  }

  if (matches.right) {
    return "e-resize";
  }

  if (matches.bottom) {
    return "s-resize";
  }

  if (matches.left) {
    return "w-resize";
  }

  return "move";
}
function resize(
  kind: Exclude<DragOperation, "move" | "none">,
  originalSize: { width: number; height: number },
  resizeDelta: { x: number; y: number }
): {
  relativeX: number;
  relativeY: number;
  width: number;
  height: number;
} {
  // TODO: clamp operations so that height and width cannot go below 10
  if (kind === "n-resize") {
    return {
      relativeX: 0,
      relativeY: resizeDelta.y,
      width: originalSize.width,
      height: originalSize.height - resizeDelta.y,
    };
  }

  if (kind === "ne-resize") {
    return {
      relativeX: 0,
      relativeY: resizeDelta.y,
      width: originalSize.width + resizeDelta.x,
      height: originalSize.height - resizeDelta.y,
    };
  }

  if (kind === "e-resize") {
    return {
      relativeX: 0,
      relativeY: 0,
      width: originalSize.width + resizeDelta.x,
      height: originalSize.height,
    };
  }

  if (kind === "se-resize") {
    return {
      relativeX: 0,
      relativeY: 0,
      width: originalSize.width + resizeDelta.x,
      height: originalSize.height + resizeDelta.y,
    };
  }

  if (kind === "s-resize") {
    return {
      relativeX: 0,
      relativeY: 0,
      width: originalSize.width,
      height: originalSize.height + resizeDelta.y,
    };
  }

  if (kind === "sw-resize") {
    return {
      relativeX: 0 + resizeDelta.x,
      relativeY: 0,
      width: originalSize.width - resizeDelta.x,
      height: originalSize.height + resizeDelta.y,
    };
  }

  if (kind === "w-resize") {
    return {
      relativeX: 0 + resizeDelta.x,
      relativeY: 0,
      width: originalSize.width - resizeDelta.x,
      height: originalSize.height,
    };
  }

  if (kind === "nw-resize") {
    return {
      relativeX: 0 + resizeDelta.x,
      relativeY: 0 + resizeDelta.y,
      width: originalSize.width - resizeDelta.x,
      height: originalSize.height - resizeDelta.y,
    };
  }

  return {
    relativeX: 0,
    relativeY: 0,
    width: originalSize.width,
    height: originalSize.height,
  };
}
function getCursorFromDragOperation(
  operation: DragOperation,
  active: boolean
): string {
  switch (operation) {
    case "move":
      return active ? "grabbing" : "auto";
    case "n-resize":
    case "s-resize":
      return "ns-resize";
    case "w-resize":
    case "e-resize":
      return "ew-resize";
    case "nw-resize":
    case "se-resize":
      return "nwse-resize";
    case "ne-resize":
    case "sw-resize":
      return "nesw-resize";

    default:
      return "auto";
  }
}
export function SelectionBox({
  edge,
  children,
}: {
  edge: BoardEdge;
  children: React.ReactNode;
}) {
  const storage = useStorage();
  const [currentAuthor] = useCurrentAuthor();
  const [state, setState] = React.useState<SelectionState>("blurred");
  const [dragOperation, setDragOperation] = React.useState<DragOperation>(
    "none"
  );
  const ref = React.useRef<HTMLDivElement>(null);

  const { setPosition, setSize } = useSetBoardEdge(edge);

  const id = useId();

  const documentOnMouseDown = React.useCallback(
    (event: Event) => {
      if (state === "blurred") {
        return;
      }

      if ((event.target as Element)?.closest(`#selection-${id}`)) {
        return;
      }

      setState("blurred");
    },
    [state, id]
  );

  const [tempTransform, setTempTransform] = React.useState({ x: 0, y: 0 });
  const [tempResize, setTempResize] = React.useState<null | Size>(null);
  const [tempSizeReference, setTempSizeReference] = React.useState({
    width: 0,
    height: 0,
  });

  const [
    predictedDragOperation,
    setPredictedDragOperation,
  ] = React.useState<DragOperation>("none");

  const unlinkDoc = useUnlinkDocFromBoard(edge.dest, edge.source);

  const onKeyDown = React.useCallback(
    (keyEvent: KeyboardEvent) => {
      const keys = ["Backspace", "Delete"];

      const { key } = keyEvent;

      if (!keys.includes(key)) {
        return;
      }

      if (state === "focused") {
        keyEvent.preventDefault();
        unlinkDoc();
      }
    },
    [unlinkDoc, state]
  );

  React.useEffect(() => {
    document.addEventListener("mousedown", documentOnMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("click", documentOnMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [documentOnMouseDown, onKeyDown]);

  const destDoc = storage?.getDocument(edge.dest);

  useGesture(
    {
      onDragStart: (dragEvent) => {
        if (state === "editing") {
          setDragOperation("none");
          return;
        }

        if (state === "blurred" || state === "hovered") {
          setState("focused");
        }

        const [initialX, initialY] = dragEvent.initial;
        const { top, bottom, left, right } = (dragEvent.event
          .target as Element).getBoundingClientRect();

        const relativePositions = {
          top: top - initialY,
          bottom: bottom - initialY,
          left: left - initialX,
          right: right - initialX,
        };

        const nextDragOperation = dragOperationFromRelativePositions(
          relativePositions
        );

        if (
          nextDragOperation !== "move" &&
          nextDragOperation !== "none" &&
          ref.current
        ) {
          const { width, height } = ref.current.getBoundingClientRect();
          setTempSizeReference({ width, height });
        }

        setDragOperation(() => nextDragOperation);
      },
      onMove: (moveEvent) => {
        if (state !== "focused" && dragOperation === "none") {
          return;
        }

        const [x, y] = moveEvent.xy;
        const { top, bottom, left, right } = (moveEvent.event
          .target as Element).getBoundingClientRect();

        const relativePositions = {
          top: top - y,
          bottom: bottom - y,
          left: left - x,
          right: right - x,
        };

        const nextDragOperation = dragOperationFromRelativePositions(
          relativePositions
        );

        setPredictedDragOperation(nextDragOperation);
      },
      onHover: (hoverEvent) => {
        if (hoverEvent.hovering === false) {
          setPredictedDragOperation("none");
        }

        setState((prev) => {
          if (!hoverEvent.hovering && prev === "hovered") {
            setState("blurred");
          }

          if (hoverEvent.hovering && prev === "blurred") {
            setState("hovered");
          }

          return prev;
        });
      },
      onDrag: (dragEvent) => {
        dragEvent.event.preventDefault();
        dragEvent.event.stopPropagation();

        const [x, y] = dragEvent.delta;

        if (dragOperation !== "move" && dragOperation !== "none") {
          const [x, y] = dragEvent.movement;

          const { height, width, relativeX, relativeY } = resize(
            dragOperation,
            tempSizeReference,
            { x, y }
          );

          requestAnimationFrame(() => {
            setTempTransform({
              x: relativeX,
              y: relativeY,
            });
            setTempResize({ height, width });
          });
        }

        if (dragOperation === "move") {
          requestAnimationFrame(() => {
            setTempTransform((prev) => ({
              x: prev.x + x,
              y: prev.y + y,
            }));
          });
        }
      },
      onDragEnd: async () => {
        if (!storage || !currentAuthor) {
          return;
        }

        if (dragOperation === "move") {
          requestAnimationFrame(() => {
            setPosition({
              x: edge.position.x + tempTransform.x,
              y: edge.position.y + tempTransform.y,
            });
          });
        }

        // TODO: isDragOperation helper
        if (
          dragOperation !== "move" &&
          dragOperation !== "none" &&
          tempResize
        ) {
          requestAnimationFrame(() => {
            setPosition({
              x: edge.position.x + tempTransform.x,
              y: edge.position.y + tempTransform.y,
            });

            setSize(tempResize);
          });
        }

        requestAnimationFrame(() => {
          setTempSizeReference({ width: 0, height: 0 });
          setTempTransform({ x: 0, y: 0 });
          setTempResize(null);
          setDragOperation("none");
        });
      },
    },
    { domTarget: ref }
  );

  const destDocDate = new Date(destDoc ? destDoc.timestamp / 1000 : Date.now());

  return (
    <div
      style={{
        position: "relative",
        transform: `translate(${tempTransform.x}px, ${tempTransform.y}px)`,
      }}
    >
      {state === "focused"
        ? [
            { top: -4, left: -4 },
            { top: -4, right: -4 },
            { bottom: -4, left: -4 },
            { bottom: -4, right: -4 },
          ].map((style, i) => (
            <TinyBoundaryBox
              key={i}
              style={{ ...style, position: "absolute" }}
            />
          ))
        : []}
      {state !== "blurred" ? (
        <div
          style={{
            position: "absolute",
            color: "rebeccapurple",
            left: 0,
            top: -12,
            right: 0,
            fontSize: 10,

            whiteSpace: "nowrap",
          }}
        >
          <div style={{ marginRight: "1ch" }}>{edge.dest}</div>
        </div>
      ) : null}
      <div
        ref={ref}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setState((prev) => (prev === "focused" ? "editing" : prev));
        }}
        id={`selection-${id}`}
        style={{
          cursor:
            dragOperation !== "none"
              ? getCursorFromDragOperation(dragOperation, true)
              : getCursorFromDragOperation(predictedDragOperation, false),
          overflow: "auto",
          width: tempResize ? tempResize.width : edge.size.width || "auto",
          height: tempResize ? tempResize.height : edge.size.height || "auto",

          borderWidth: 1,
          borderStyle: state === "hovered" ? "dashed" : "solid",
          borderColor:
            state === "hovered"
              ? "rebeccapurple"
              : state === "blurred"
              ? "transparent"
              : state === "focused"
              ? "rebeccapurple"
              : "green",
        }}
      >
        <SelectionContext.Provider value={{ editing: state === "editing" }}>
          <div
            style={{
              pointerEvents: state === "editing" ? "auto" : "none",
              height: "100%",
            }}
          >
            {children}
          </div>
        </SelectionContext.Provider>
      </div>
      {state !== "blurred" ? (
        <div
          style={{
            position: "absolute",
            color: "rebeccapurple",
            left: 0,
            bottom: -12,
            right: 0,
            fontSize: 10,
            display: "flex",
            justifyContent: "flex-end",
            whiteSpace: "nowrap",
          }}
        >
          <span>
            <b>
              <AuthorLabel address={destDoc?.author || ""} />
            </b>{" "}
            {formatDistance(destDocDate, new Date(), {
              addSuffix: true,
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function TinyBoundaryBox({ style }: { style: React.CSSProperties }) {
  return (
    <div
      style={{
        border: "1px solid rebeccapurple",
        background: "white",
        width: 8,
        height: 8,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
