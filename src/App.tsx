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
      x: edge.data.x + viewX,
      y: edge.data.y + viewY,
    },
  }));
}

function Board() {
  const storage = useStorage(WORKSPACE_ADDR);

  const [viewX, setViewX] = React.useState(0);
  const [viewY, setViewY] = React.useState(0);

  const translatedEdges = useTranslatedPlacedEdges(viewX, viewY, BOARD_PATH);

  return (
    <div>
      <div
        id={"canvas"}
        style={{
          position: "relative",
          background: "black",
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

          const translatedX = x - viewX;
          const translatedY = y - viewY;

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
            background: "#e9e9e9",
            pointerEvents: "none",
            width: `calc(100% + ${Math.abs(viewX)}px)`,
            height: `calc(100% + ${Math.abs(viewY)}px)`,
          }}
        ></div>
        <div
          style={{ position: "fixed", top: 0, left: 0 }}
        >{`x: ${viewX} y: ${viewY}`}</div>

        {translatedEdges.map((edge) => (
          <div
            key={edge.dest}
            style={{
              border: "1px solid red",
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
