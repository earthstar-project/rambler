import * as React from "react";
import {
  StorageLocalStorage,
  ValidatorEs4,
  StorageToAsync,
  isErr,
  Document,
} from "earthstar";
import {
  EarthstarPeer,
  useStorage,
  useSubscribeToStorages,
} from "react-earthstar";
import {
  EdgeContent,
  findEdgesAsync,
  GraphQuery,
  writeEdge,
} from "earthstar-graph-db";
import useDeepCompareEffect from "use-deep-compare-effect";

import "./App.css";

// Hardcoding values for things now
const WORKSPACE_ADDR = "+triplextest.a6udu8ab";
const PUBS = ["https://earthstar-demo-pub-v5-a.glitch.me"];
const TRIPLEX_DIR = "/triplex-v0.0.1";
const BOARD_PATH = `${TRIPLEX_DIR}/board.json`;
const TEST_AUTHOR = {
  address: "@test.bqokp2sykon4qqou6q5sajjea3r3ng3kwg6psbchvlmy4mucimtwa",
  secret: "bzb3boqgppn2tylnzhz6es5lgrtcrwrirryxarvsjezcaloevtjzq",
};

const WorkspaceStorage = new StorageToAsync(
  new StorageLocalStorage([ValidatorEs4], WORKSPACE_ADDR)
);

function App() {
  return (
    <EarthstarPeer
      initWorkspaces={[WorkspaceStorage]}
      initPubs={{ [WORKSPACE_ADDR]: PUBS }}
      initCurrentWorkspace={WORKSPACE_ADDR}
      initIsLive={false}
    >
      <Board />
    </EarthstarPeer>
  );
}

// TODO: pull this into react-earthstar

function useEdges<EdgeData>(
  query: GraphQuery,
  workspaceAddress?: string
): (Omit<EdgeContent, "data"> & { data: EdgeData })[] {
  const storage = useStorage(workspaceAddress);

  const [edges, setEdges] = React.useState<Document[]>([]);

  useDeepCompareEffect(() => {
    let ignore = false;

    if (!storage) {
      return;
    }

    findEdgesAsync(storage, query).then((edges) => {
      if (!isErr(edges) && !ignore) {
        setEdges(edges);
      }
    });

    return () => {
      ignore = true;
    };
  }, [storage, query]);

  const { dest, kind, owner, source } = query;

  const onWrite = React.useCallback(() => {
    if (!storage) {
      return;
    }

    findEdgesAsync(storage, { dest, kind, owner, source }).then((edges) => {
      if (!isErr(edges)) {
        setEdges(edges);
      }
    });
  }, [dest, kind, owner, source, storage]);

  useSubscribeToStorages({
    workspaces: storage ? [storage.workspace] : [],

    onWrite,
  });

  return edges.map((edgeDoc) => JSON.parse(edgeDoc.content));
}

type Position = { x: number; y: number };
type Size = { width: number; height: number };

// viewX and viewY are the positions of the viewport's top left edge relative to the top left point of the board.
function useTranslatedPlacedEdges(
  viewX: number,
  viewY: number,
  boardPath: string
) {
  const placedEdges = useEdges<Position>({
    source: boardPath,
    kind: "PLACED",
  });

  return placedEdges.map((edge) => ({
    ...edge,
    data: {
      x: edge.data.x - viewX,
      y: edge.data.y - viewY,
    },
  }));
}

function getBoardCorners(
  edges: (Omit<EdgeContent, "data"> & { data: Position })[]
) {
  return edges.reduce(
    (acc, edge) => {
      return {
        top: Math.min(edge.data.y, acc.top),
        left: Math.min(edge.data.x, acc.left),
        bottom: Math.max(edge.data.y, acc.bottom),
        right: Math.max(edge.data.x, acc.right),
      };
    },
    { top: 0, left: 0, bottom: 0, right: 0 }
  );
}

function Board() {
  const storage = useStorage(WORKSPACE_ADDR);

  const [viewX, setViewX] = React.useState(0);
  const [viewY, setViewY] = React.useState(0);

  const translatedEdges = useTranslatedPlacedEdges(viewX, viewY, BOARD_PATH);
  const edges = useEdges<Position>({
    source: BOARD_PATH,
    kind: "PLACED",
  });

  const boardCorners = getBoardCorners(edges);

  const canvasRef = React.useRef<HTMLDivElement>(null);

  const intrinsicWidth = boardCorners.right - boardCorners.left;
  const intrinsicHeight = boardCorners.bottom - boardCorners.top;

  // want to add the difference between board edges and viewport edges
  const viewportTopEdge = viewY;
  const viewportLeftEdge = viewX;
  const viewportBottomEdge =
    (canvasRef.current?.getBoundingClientRect().height || 0) + viewY;
  const viewportRightEdge =
    (canvasRef.current?.getBoundingClientRect().width || 0) + viewX;

  const topBoardEdgeDifference = boardCorners.top - viewportTopEdge;
  const leftBoardEdgeDifference = boardCorners.left - viewportLeftEdge;
  const rightBoardEdgeDifference = viewportRightEdge - boardCorners.right;
  const bottomBoardEdgeDifference = viewportBottomEdge - boardCorners.bottom;

  const boardWidth =
    Math.max(leftBoardEdgeDifference, 0) +
    intrinsicWidth +
    Math.max(rightBoardEdgeDifference, 0);
  const boardHeight =
    Math.max(topBoardEdgeDifference, 0) +
    intrinsicHeight +
    Math.max(bottomBoardEdgeDifference, 0);

  console.group(`${viewX} ${viewY}`);

  console.log({ intrinsicWidth, intrinsicHeight });

  console.log({
    viewportTopEdge,
    viewportLeftEdge,
    viewportRightEdge,
    viewportBottomEdge,
  });

  console.log(boardCorners);

  console.log({
    topBoardEdgeDifference,
    leftBoardEdgeDifference,
    rightBoardEdgeDifference,
    bottomBoardEdgeDifference,
  });

  console.log({ boardWidth, boardHeight });

  console.groupEnd();

  React.useEffect(() => {
    if (canvasRef.current && viewX === 0 && viewY === 0) {
      canvasRef.current.scrollTop = Math.abs(boardCorners.top);
      canvasRef.current.scrollLeft = Math.abs(boardCorners.left);
    }
  }, [boardCorners.top, boardCorners.left, viewX, viewY]);

  return (
    <div>
      <div
        ref={canvasRef}
        id={"canvas"}
        style={{
          position: "relative",
          background: "blue",
          height: "100vh",
          width: "100vw",
          overflow: "auto",
        }}
        onWheel={(wheelEvent) => {
          const { deltaX, deltaY } = wheelEvent;

          setViewY((prev) => prev + deltaY);
          setViewX((prev) => prev + deltaX);
        }}
        onClick={async (clickEvent) => {
          if (!storage) {
            return;
          }

          const {
            left,
            top,
          } = clickEvent.currentTarget.getBoundingClientRect();

          const x = clickEvent.clientX - left;
          const y = clickEvent.clientY - top;

          const translatedX = x + viewX;
          const translatedY = y + viewY;

          console.log({
            x,
            y,
            translatedX,
            translatedY,
          });

          const docPath = `${TRIPLEX_DIR}/${Date.now()}.txt`;

          const writeResult = await storage?.set(TEST_AUTHOR, {
            content: "Test!",
            format: "es.4",
            path: docPath,
          });

          if (isErr(writeResult)) {
            console.error(writeResult);
            return;
          }

          writeEdge(storage, TEST_AUTHOR, {
            owner: "common",
            data: { x: translatedX, y: translatedY },
            source: BOARD_PATH,
            dest: docPath,
            kind: "PLACED",
          });
        }}
      >
        <div
          id={"board"}
          style={{
            background: "#eaeaea",
            pointerEvents: "none",
            width: boardWidth,
            height: boardHeight,
          }}
        ></div>
        <div
          style={{ position: "fixed", top: 0, left: 0 }}
        >{`x: ${viewX} y: ${viewY}`}</div>

        {translatedEdges.map((edge) => (
          <div
            key={edge.dest}
            style={{
              border: "2px solid black",
              borderRadius: "50%",
              top: edge.data.y,
              left: edge.data.x,
              position: "fixed",
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}

export default App;
