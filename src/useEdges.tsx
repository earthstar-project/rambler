import * as React from "react";
import {
    isErr,
    Document
} from "earthstar";
import {
    useStorage,
    useSubscribeToStorages
} from "react-earthstar";
import {
    EdgeContent,
    findEdgesAsync,
    GraphQuery
} from "earthstar-graph-db";
import useDeepCompareEffect from "use-deep-compare-effect";

// TODO: pull this into react-earthstar
export function useEdges<EdgeData>(
    query: GraphQuery,
    workspaceAddress?: string): (Omit<EdgeContent, "data"> & { data: EdgeData; })[] {
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
        paths: edges.map((edgeDoc) => edgeDoc.path),
        onWrite,
    });

    return edges.map((edgeDoc) => JSON.parse(edgeDoc.content));
}
