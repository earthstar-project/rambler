import * as React from "react";
import { StorageLocalStorage, ValidatorEs4, StorageToAsync } from "earthstar";
import { EarthstarPeer } from "react-earthstar";
import "./App.css";
import { WORKSPACE_ADDR, PUBS, TEST_AUTHOR, BOARD_PATH } from "./constants";
import { Board } from "./Board";
import BoardStore from "./BoardStore";

const WorkspaceStorage = new StorageToAsync(
  new StorageLocalStorage([ValidatorEs4], WORKSPACE_ADDR)
);

function App() {
  return (
    <EarthstarPeer
      initWorkspaces={[WorkspaceStorage]}
      initPubs={{ [WORKSPACE_ADDR]: PUBS }}
      initCurrentWorkspace={WORKSPACE_ADDR}
      initCurrentAuthor={TEST_AUTHOR}
      initIsLive={true}
    >
      <BoardStore>
        <Board boardPath={BOARD_PATH} />
      </BoardStore>
    </EarthstarPeer>
  );
}

export default App;
