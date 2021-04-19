import * as React from "react";
import { StorageLocalStorage, ValidatorEs4 } from "earthstar";
import { EarthstarPeer } from "react-earthstar";
import "./App.css";
import { WORKSPACE_ADDR, PUBS, TEST_AUTHOR, BOARD_PATH } from "./constants";
import { Board } from "./Board";

function App() {
  return (
    <EarthstarPeer
      initWorkspaces={[WORKSPACE_ADDR]}
      initPubs={{ [WORKSPACE_ADDR]: PUBS }}
      initCurrentWorkspace={WORKSPACE_ADDR}
      initCurrentAuthor={TEST_AUTHOR}
      initIsLive={false}
      onCreateWorkspace={(address) =>
        new StorageLocalStorage([ValidatorEs4], address)
      }
    >
      <Board boardPath={BOARD_PATH} />
    </EarthstarPeer>
  );
}

export default App;
