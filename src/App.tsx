import * as React from "react";
import { StorageLocalStorage, ValidatorEs4, StorageToAsync } from "earthstar";
import { EarthstarPeer } from "react-earthstar";
import "./App.css";
import { WORKSPACE_ADDR, PUBS, TEST_AUTHOR } from "./constants";
import { Board } from "./Board";

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
      <Board />
    </EarthstarPeer>
  );
}

export default App;
